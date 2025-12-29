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
import { StdLogger } from "./logger";

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
	const LOG: StdLogger = new StdLogger("info", false);

	LOG.info("Initiating Delicious Fruit NG 1.0.0-rc.0 server startup.");

	// TODO: database initialization step, currently assumed database is already initialized

	// HACK: but actually do db initialization, but only if we detect we're in CI
	if (process.env.__DF_TEST_RUN) {
		LOG.debug("Test run detected, executing alternative startup actions.");
		await sleep(1000 * 45); // HACK: wait for mysql to startup
		const cfg = { ...config.db };
		delete cfg.database; // HACK: we don't want to set this
		LOG.debug("Connecting to the database server.");
		const conn: Connection = mysql.createConnection(cfg);
		LOG.debug("Creating the database.");
		conn.connect((e) => {
			LOG.error(e, "Connection to database could not be established.");
		});
		await sleep(1000 * 5);
		conn.execute(
			"CREATE DATABASE IF NOT EXISTS delfruit",
			[],
			(e, res, fields) => {
				LOG.trace(
					{ error: e, resultsrows: res, fields },
					"SQL Execution of the create database statement.",
				);
			},
		);
		await sleep(1000 * 5);

		LOG.debug("Running migrations from scratch.");
		const db = new Database();
		LOG.trace("Loading migrations from disk.");
		const filenames = await fsAsync.readdir("./src/migrations");
		LOG.trace(filenames, "Migration files to be ran.");
		for (const filename of filenames) {
			const fileBlob = await fsAsync.readFile(
				`./src/migrations/${filename}`,
				{},
			);
			const res = await db.execute(String(fileBlob), []);
			LOG.debug(res, "Migration result");
		}
	}

	LOG.info("Initializing Express.js.");

	const app = express();
	app.locals = { LOG };

	LOG.debug("Enabling CORS middleware for Express.js.");
	app.use(cors());

	LOG.debug("Enabling JSON Body Parser middleware for Express.js.");
	app.use(bodyParser.json({ type: "application/json" }));

	LOG.debug(
		"Enabling JSON Web Tokens w/ Refresh Tokens middleware for Express.js.",
	);
	app.use(
		jwt_middleware({
			secret: config.app_jwt_secret,
			credentialsRequired: false,
		}),
	);
	app.use(refreshToken());

	LOG.debug("Enabling Role middleware for Express.js.");
	app.use((req, res, next) => {
		if (req.user) {
			req.user.roles = ["game_update"];
		}
		next();
	});

	LOG.debug("Enabling Custom Error Request Handler middleware for Express.js.");
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

	LOG.info("Initializing S3 Object Storage.");
	try {
		const minioClient = new Minio.Client(config.s3);

		const bucketJustCreated = await new Promise((res, rej) => {
			minioClient.bucketExists(config.s3_bucket, (err, exists) => {
				if (err) return rej(err);
				else if (exists) return res(false);
				LOG.warn(config.s3_bucket, "Bucket doesn't exist, creating a new one.");
				minioClient.makeBucket(config.s3_bucket, config.s3_region, (err) => {
					if (err) return rej(err);
					console.log(
						`Bucket ${config.s3_bucket} created successfully in ${config.s3_region}.`,
					);
					res(true);
				});
			});
		});

		if (bucketJustCreated) {
			LOG.warn(config.s3_bucket, "Setting public read policy on bucket.");
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
		LOG.fatal(e, "S3 Object Storage initialization failure.");
		return ExitCode.S3_INIT_FAIL;
	}

	LOG.debug("Initalizing Swagger UI middleware for Express.js.");
	fs.readFile(
		path.join(__dirname, "../build/swagger.json"),
		{ encoding: "utf-8" },
		(err, data) => {
			if (err) {
				return console.error(
					`OpenAPI definition could not be opened or found: ${err}`,
				);
			}
			const specs = JSON.parse(data);
			app.use("/", swaggerUi.serve, swaggerUi.setup(specs));
		},
	);

	if (config.bcrypt_rounds < 10) {
		LOG.warn(
			config.bcrypt_rounds,
			"bcrypt_rounds in config is less than 10. Lower values mean faster hash attempts for password crackers!",
		);
	}

	LOG.debug("Initializing Rate Limiting middleware for Express.js.");
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
	app.use(expressRateLimiter);

	LOG.debug("Initalizing Speed Limiter middleware for Express.js.");
	const expressSpeedLimiter = slowDown({
		windowMs: 1000 * 60 * 15,
		delayAfter: 30,
		delayMs: (hits) => hits * 250,
		identifier: "exprSpdLmt-",
		store: new MemcachedStore({ prefix: "exprSpdLmt-", client: memcached }),
	});
	//app.use(expressSpeedLimiter);

	LOG.info("Registering API routes.");
	app.use(urlencoded({ extended: true }));
	RegisterRoutes(app);

	LOG.info("Startup finished.");
	try {
		const server = app.listen(config.app_port, () => {
			LOG.info(`Server started at localhost:${config.app_port}!`);
		});

		process.on("SIGTERM", () => {
			server.close(() => {});
		});

		while (server.listening) {
			await sleep(4);
		}
	} catch (e) {
		LOG.fatal(e, "Application unexpectantly terminated.");
	} finally {
		memcached.end();
	}

	LOG.info("Application finished, shutting down.");

	return ExitCode.SUCCESS;
}

(async () => {
	process.exit(await main());
})();
