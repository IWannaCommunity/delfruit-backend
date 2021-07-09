import express, { ErrorRequestHandler } from 'express';
import bodyParser from 'body-parser';
import uuid from 'uuid/v4';
import cors from 'cors';

import jwt_middleware from 'express-jwt';
import game_router from './game-router';
import user_router from './user-router';
import review_router from './review-router';
import list_router from './list-router';
import auth_router from './auth-router';
import ping_router from './ping-router';
import message_router from './message-router';
import screenshot_router from './screenshot-router';
import news_router from './news-router';
import report_router from './report-router';
import tag_router from './tag-router';
import api_router from './api-router';
import { Database } from './database';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import * as Minio from 'minio';
import { refreshToken } from './lib/auth-check';
import Config from './model/config';
let config: Config = require('./config/config.json');

/** Exit codes for fatal errors. */
enum ExitCode {
    /** Database initialization failed. */
    DB_INIT_FAIL = 1,
    /** S3 Object storage initialization failed. */
    S3_INIT_FAIL = 2
}

//self executing async function that allows the initialization to halt if a
//fatal error occurs in an asynchronous function (like database init)
(async () => {

    console.log('Welcome to delfruit server 2.0!');

    try {
        await Database.init();
    } catch (e) {
        console.error("Database initialization failed! Is it running? check "+config.db.host);
        console.error(e);
        process.exit(ExitCode.DB_INIT_FAIL);
    }

    console.log('Initializing express...');

const app = express();
/*app.use(function (req,res,next) {
console.log(req.originalUrl);
next();
    });*/

    app.use(cors())

    app.use(bodyParser.json({type:"application/json"}));

    console.log('Initializing jwt middleware...');

    app.use(jwt_middleware({
        secret: config.app_jwt_secret,
        credentialsRequired: false
    }));
    app.use(refreshToken());

    console.log('Initializing role middleware...');

    app.use((req,res,next) => {
        if (req.user) {
            req.user.roles = ['game_update'];
        }
        next();
    });

    const e: ErrorRequestHandler = (err,req,res,next) => {
        if (err && err.name && err.name === 'UnauthorizedError') {
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
            id: id
        });
    }
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
                if (typeof chunks[0] ==='string') body = chunks.join();
                else body = Buffer.concat(chunks).toString('utf8');
                console.log("ERROR: ", res.statusCode, req.path, body);
            }
            // @ts-ignore
            oldEnd.apply(res, arguments);
        };

        next();
    });

    console.log('Initializing routers...');

    app.use('/api/games',game_router);
    app.use('/api/users',user_router);
    app.use('/api/reviews',review_router);
    app.use('/api/lists',list_router);
    app.use('/api/auth',auth_router);
    app.use('/api/ping',ping_router);
    app.use('/api/message',message_router);
    app.use('/api/screenshots',screenshot_router);
    app.use('/api/news',news_router);
    app.use('/api/reports',report_router);
    app.use('/api/tags',tag_router);
    app.use('/api/api',api_router);

    console.log('Initializing object storage...');

    try {
        const minioClient = new Minio.Client(config.s3);

        const bucketJustCreated = await new Promise((res,rej) => {
            minioClient.bucketExists(config.s3_bucket,(err,exists)=>{
                if (err) return rej(err);
                else if (exists) return res(false);
                console.log(`Bucket ${config.s3_bucket} doesn't exist, intializing.`)
                minioClient.makeBucket(config.s3_bucket, config.s3_region, (err) => {
                    if (err) return rej(err);
                    console.log(`Bucket ${config.s3_bucket} created successfully in ${config.s3_region}.`)
                    res(true);
                });
            });
        });

        if (bucketJustCreated) {
            console.log(`Setting public read policy on ${config.s3_bucket}`)
            await new Promise((res,rej)=>{
                minioClient.setBucketPolicy(config.s3_bucket,`{
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
                    }`,(err) => {
                        if (err) return rej(err);
                        else res();
                    }
                );
            });
        }
    } catch (e) {
        console.error("S3 initialization failed!");
        console.error(e);
        process.exit(ExitCode.S3_INIT_FAIL);
    }

    console.log('Initializing swagger...');

    const options = {
        swaggerDefinition: {
            // Like the one described here: https://swagger.io/specification/#infoObject
            info: {
                title: 'Delicious Fruit API',
                version: '2.0.0',
                description: 'The API you should use instead of throwing your monitor out the window',
            },
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                    }
                }
            },
            openapi: "3.0.0",
            security: [{
                bearerAuth: []
            }],
            basePath: '/api',
            scheme: "http",
            host: "localhost:4201",
        },
        apis: [__dirname+'/*.ts'],
    };

    const specs = swaggerJsdoc(options);
    app.use('/api/swagger', swaggerUi.serve, swaggerUi.setup(specs));

    if (config.bcrypt_rounds < 10) {
        console.log("WARNING!! bcrypt_rounds is less than 10. "+
            "Lower values mean faster hash attempts for password crackers!");
    }

    console.log('Starting app...');

    app.listen(config.app_port,  () => {
        console.log(`Server started at localhost:${config.app_port}!`);
    });

})();
