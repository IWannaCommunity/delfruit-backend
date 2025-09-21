import express, { ErrorRequestHandler, urlencoded } from "express";
import bodyParser from "body-parser";
import uuid from "uuid/v4";
import cors from "cors";

import jwt_middleware from "express-jwt";
import { Database } from "./database";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import * as Minio from "minio";
import { refreshToken } from "./lib/auth-check";
import Config from "./model/config";
import { RegisterRoutes } from "../build/routes";
let config: Config = require("./config/config.json");

import fs from "fs";
const fsAsync = fs.promises;
import path from "path";
import process from "process";
import mysql, { Connection } from "mysql2";
import { slowDown } from "express-slow-down";
import { MemcachedStore } from "rate-limit-memcached";
import { memcached } from "./datastore";
import { rateLimit } from "express-rate-limit";
import axios from "axios";

/** Exit codes for fatal errors. */
enum ExitCode {
	SUCCESS = 0,
	/** Database initialization failed. */
	DB_INIT_FAIL = 1,
	/** S3 Object storage initialization failed. */
	S3_INIT_FAIL = 2,
}

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

/**
 * @swagger
 * components:
 *      schemas:
 *              Error:
 *                      type: object
 *                      properties:
 *                              error:
 *                                      type: string
 *                      required:
 *                              - error
 */

async function main(): Promise<number> {
	console.log("Welcome to delfruit server 2.0!");

	// TODO: database initialization step, currently assumed database is already initialized

	// HACK: but actually do db initialization, but only if we detect we're in CI
	if (process.env.__DF_TEST_RUN) {
		console.log("Initializing the database");
		await sleep(1000 * 45); // HACK: wait for mysql to startup
		const cfg = { ...config.db };
		delete cfg.database; // HACK: we don't want to set this
		console.log("Connecting to the database server.");
		const conn: Connection = mysql.createConnection(cfg);
		console.log("Creating the database.");
		conn.connect((e) => {
			console.log(`connect error: ${e}`);
		});
		await sleep(1000 * 5);
		conn.execute("CREATE DATABASE IF NOT EXISTS delfruit", [], (e, res, fields) => {
			console.log(`error: ${e}`);
			console.log(`resultsrows: ${res}`);
			console.log(`fields: ${fields}`);
		});
		await sleep(1000 * 5);

		console.log("Running migrations");
		const db = new Database();
		const filenames = await fsAsync.readdir("./src/migrations");
		console.log(`Migration files to be run: ${filenames}`);
		for (const filename of filenames) {
			const fileBlob = await fsAsync.readFile(`./src/migrations/${filename}`, {});
			const res = await db.execute(String(fileBlob), []);
			console.log(`migration res: ${res}`);
		}
	}

	console.log("Initializing express...");

	const app = express();

	app.use(cors());

	app.use(bodyParser.json({ type: "application/json" }));

	console.log("Initializing jwt middleware...");

	app.use(
		jwt_middleware({
			secret: config.app_jwt_secret,
			credentialsRequired: false,
		}),
	);
	app.use(refreshToken());

	console.log("Initializing role middleware...");

	app.use((req, res, next) => {
		if (req.user) {
			req.user.roles = ["game_update"];
		}
		next();
	});

	const e: ErrorRequestHandler = (err, req, res, next) => {
		if (err && err.name && err.name === "UnauthorizedError") {
			//invalid token, jwt middleware returns more info in the err
			//but we don't want the client to see
			// message: 'jwt malformed',
			// code: 'invalid_token',
			return res.sendStatus(401);
		}

		const id = uuid();
		console.log(`severe error: id ${id}`);
		console.log(err);
		res.status(500).send({
			error: "Internal Server Error",
			id: id,
		});
	};
	app.use(e);

	// DEBUG ERROR LOGGING
	app.use((req, res, next) => {
		var oldWrite = res.write,
			oldEnd = res.end;

		var chunks: any[] = [];

		res.write = function (chunk: any) {
			chunks.push(chunk);
			// @ts-ignore
			return oldWrite.apply(res, arguments);
		};

		res.end = function (chunk: any) {
			if (chunk) chunks.push(chunk);
			if (this.statusCode >= 400) {
				let body: string;
				if (typeof chunks[0] === "string") body = chunks.join();
				else body = Buffer.concat(chunks).toString("utf8");
				console.log("ERROR: ", res.statusCode, req.path, body);
			}
			// @ts-ignore
			oldEnd.apply(res, arguments);
		};

		next();
	});

	console.log("Initializing object storage...");

	try {
		const minioClient = new Minio.Client(config.s3);

		const bucketJustCreated = await new Promise((res, rej) => {
			minioClient.bucketExists(config.s3_bucket, (err, exists) => {
				if (err) return rej(err);
				else if (exists) return res(false);
				console.log(`Bucket ${config.s3_bucket} doesn't exist, intializing.`);
				minioClient.makeBucket(config.s3_bucket, config.s3_region, (err) => {
					if (err) return rej(err);
					console.log(`Bucket ${config.s3_bucket} created successfully in ${config.s3_region}.`);
					res(true);
				});
			});
		});

		if (bucketJustCreated) {
			console.log(`Setting public read policy on ${config.s3_bucket}`);
			await new Promise((res, rej) => {
				minioClient.setBucketPolicy(
					config.s3_bucket,
					`{
          "Version": "2012-10-17",
          "Id": "Public Access to Screenshots",
          "Statement": [
            {
              "Sid": "PublicRead",
              "Effect": "Allow",
              "Principal": "*",
              "Action": "s3:GetObject",
              "Resource": "arn:aws:s3:::${config.s3_bucket}/*"
            }
          ]
                    }`,
					(err) => {
						if (err) return rej(err);
						else res();
					},
				);
			});
		}
	} catch (e) {
		console.error("S3 initialization failed!");
		console.error(e);
		return ExitCode.S3_INIT_FAIL;
	}

	console.log("Initializing swagger...");

	fs.readFile(path.join(__dirname, "../build/swagger.json"), { encoding: "utf-8" }, (err, data) => {
		if (err) {
			return console.error(`OpenAPI definition could not be opened or found: ${err}`);
		}
		const specs = JSON.parse(data);
		app.use("/", swaggerUi.serve, swaggerUi.setup(specs));
	});

	if (config.bcrypt_rounds < 10) {
		console.log(
			"WARNING!! bcrypt_rounds is less than 10. " +
				"Lower values mean faster hash attempts for password crackers!",
		);
	}

	console.log("Initializing Rate Limiting middleware");
	const expressRateLimiter = rateLimit({
		windowMs: 1000 * 60 * 5,
		max: 350, // TODO: remove this on a newer version of this library
		limit: 350, // TODO: lower this on release
		standardHeaders: "draft-8",
		legacyHeaders: true,
		ipv6Subnet: 48,
		identifier: "exprRateLmt-",
		store: new MemcachedStore({ prefix: "exprRateLmt-", client: memcached }),
	});
	console.log(expressRateLimiter);
	app.use(expressRateLimiter);

	console.log("Initializing Speed Limiting middleware");
	const expressSpeedLimiter = slowDown({
		windowMs: 1000 * 60 * 15,
		delayAfter: 30,
		delayMs: (hits) => hits * 250,
		identifier: "exprSpdLmt-",
		store: new MemcachedStore({ prefix: "exprSpdLmt-", client: memcached }),
	});
	console.log(expressSpeedLimiter);
	app.use(expressSpeedLimiter);

	console.log("Initializing routers...");

	app.use(urlencoded({ extended: true }));
	RegisterRoutes(app);

	console.log("Starting app...");

	try {
		const server = app.listen(config.app_port, () => {
			console.log(`Server started at localhost:${config.app_port}!`);
		});

		process.on("SIGTERM", () => {
			server.close(() => {});
		});

		while (server.listening) {
			await sleep(4);
		}
	} catch (e) {
		console.error(e);
	} finally {
		memcached.end();
	}

	console.log("app done");

	return ExitCode.SUCCESS;
}

(async () => {
	process.exit(await main());
})();
