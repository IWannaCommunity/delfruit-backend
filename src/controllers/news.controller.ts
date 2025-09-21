import express from 'express';
import datastore from '../datastore';
import { News } from '../model/News';
import handle from '../lib/express-async-catch';
import { adminCheck } from '../lib/auth-check';
import { Body, Controller, Delete, Get, Header, Patch, Path, Post, Query, Response, Route, Security, SuccessResponse, Tags } from 'tsoa';

const app = express.Router();
export default app;

import * as jwt from "jsonwebtoken";
import Config from '../model/config';
let config: Config = require('../config/config.json');
function extractBearerJWT(header_token: string): string | object {
    if (!header_token.includes("Bearer ")) {
        throw new Error("missing prefix")
    }
    const unverified_token = header_token.split(" ")[1];

    try {
        return jwt.verify(unverified_token, config.app_jwt_secret);
    } catch (e) {
        throw new Error(`invalid token: ${e}`)
    }
}

@Tags("News")
@Route("news")
export class NewsController extends Controller {
    @SuccessResponse(200, "List of News")
    @Get()
    public async getAllNews(@Query() page?: number = 0, @Query() limit?: number = 50): Promise<News[]> {
        const n = await datastore.getNewses({
            page: +page,
            limit: +limit,
            removed: false
        });

        return n;

    }

    @SuccessResponse(200, "News Story")
    @Response<void>(404, "Not Found")
    @Get("{id}")
    public async getNews(@Path() id: number): Promise<News> {

        const n = await datastore.getNewses({ id: +id, page: 0, limit: 1, removed: false });
        if (!n || n.length == 0) return this.setStatus(404);
        return n[0];

    }

    @Security("bearerAuth", ["admin"])
    @SuccessResponse(204, "Successfully Deleted")
    @Response<void>(404, "Not Found")
    @Delete("{id}")
    public async deleteNews(@Path() id: number): Promise<void> {
        const oldNews = await datastore.getNewses({ id: +id, page: 0, limit: 1, removed: false });
        if (!oldNews || oldNews.length == 0) return this.setStatus(404);

        const news: News = {
            id: +id,
            removed: true
        };

        const success = await datastore.updateNews(news);
        if (!success) return this.setStatus(404);
        return this.setStatus(204);

    }

    @Security("bearerAuth", ["admin"])
    @SuccessResponse(204, "Successfully Edited")
    @Response<void>(404, "Not Found")
    @Patch("{id}")
    public async patchNews(@Path() id: number, @Body() requestBody: News): Promise<void> {
        const oldNews = await datastore.getNewses({ id: +id, page: 0, limit: 1, removed: false });
        if (!oldNews || oldNews.length == 0) return this.setStatus(404);

        const news: News = {
            id: +id,
            title: requestBody.title,
            short: requestBody.short,
            news: requestBody.news
        };

        const success = await datastore.updateNews(news);
        if (!success) return this.setStatus(404);
        return this.setStatus(204);

    }

    @Security("bearerAuth", ["admin"])
    @SuccessResponse(201, "Created")
    @Response<void>(400, "")
    @Post()
    public async postNews(@Header("Authorization") authorization: string, @Body() requestBody: News): Promise<News> {
        // NOTE: auth guard should make the error condition unreachable
        const user = extractBearerJWT(authorization);

        const uid = user.sub;
        const article = requestBody;
        const news = await datastore.addNews(article, uid);

        this.setStatus(201);
        return news;

    }
}
