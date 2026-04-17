import express from "express";
import {
    Body,
    Controller,
    Delete,
    Get,
    Header,
    Patch,
    Path,
    Post,
    Put,
    Response,
    Route,
    Security,
    SuccessResponse,
    Tags,
} from "tsoa";
import datastore from "../datastore";
import { userCheck } from "../lib/auth-check";
import handle from "../lib/express-async-catch";
import type { List } from "../model/List";

const app = express.Router();
export default app;

import type Config from "../model/config";

const config: Config = require("../config/config.json");

import * as jwt from "jsonwebtoken";
import { Game } from "../model/Game";
import { APIError } from "../model/response/error";

function extractBearerJWT(header_token: string): string | object {
    if (!header_token.includes("Bearer ")) {
        throw new Error("missing prefix");
    }
    const unverified_token = header_token.split(" ")[1];

    try {
        return jwt.verify(unverified_token, config.app_jwt_secret);
    } catch (e) {
        throw new Error(`invalid token: ${e}`);
    }
}

@Tags("Lists")
@Route("lists")
export class ListController extends Controller {
    @Security("bearerAuth", ["user"])
    @SuccessResponse(201, "Created")
    @Post()
    public async postList(
        @Header("Authorization") authorization: string,
        @Body() requestBody: List,
    ): Promise<List> {
        // NOTE: auth guard should make the error condition unreachable
        const user = extractBearerJWT(authorization);

        const list = await datastore.addList(requestBody, user.sub);
        return list;
    }

    /**
     * Update List (User/Admin Only)
     * @summary Update List (User/Admin Only)
     */
    @Security("bearerAuth", ["user"])
    @SuccessResponse(200, "Updated Successfully")
    @Patch("{id}")
    public async patchList(
        @Header("Authorization") authorization: string,
        @Path() id: number,
    ): Promise<void> {
        // TODO: currently unimplemented
    }

    /**
     * Get List
     * @summary Get List
     */
    @SuccessResponse(200, "Found")
    @Get("{id}")
    public async getList(
        @Header("Authorization") authorization: string,
        @Path() id: number,
    ): Promise<void> {
        // TODO: currently unimplemented
    }

    /**
     * Get List Contents
     * @summary Get List Contents
     */
    @SuccessResponse(200, "Found")
    @Get("{id}/games")
    public async getListGames(
        @Header("Authorization") authorization: string,
        @Path() id: number,
    ): Promise<void> {
        // TODO: currently unimplemented
    }

    /**
     * Replace Games in List (User/Admin Only)
     * @summary Replace Games in List (User/Admin Only)
     */
    @Security("bearerAuth", ["user"])
    @SuccessResponse(204, "Updated Successfully")
    @Response<void>(403, "Bad Ownership")
    @Response<void>(404, "Not Found")
    @Put("{id}/games")
    public async putList(
        @Header("Authorization") authorization: string,
        @Path() id: number,
        @Body() requestBody: any,
    ): Promise<void> {
        // NOTE: auth guard should make the error condition unreachable
        const user = extractBearerJWT(authorization);

        const list = await datastore.getList(id);
        if (!list) return this.setStatus(404);

        if (list.userId !== user.sub) return this.setStatus(403);

        const games = await datastore.getListGames(id);
        if (games.includes(requestBody.gameId)) return this.setStatus(204);

        await datastore.addGameToList(id, requestBody.gameId);
        return this.setStatus(204);
    }

    /**
     * Delete List (User/Admin Only)
     * @summary Delete List (User/Admin Only)
     */
    @Security("bearerAuth", ["user"])
    @SuccessResponse(200, "Deleted")
    @Response<void>(403, "Bad Ownership")
    @Response<void>(404, "Not Found")
    @Delete("{id}")
    public async deleteList(
        @Header("Authorization") authorization: string,
        @Path() id: number,
    ): Promise<void> {
        // don't allow deleting lists 1,2 - favorites and clears
        // TODO: unimplemented
    }

    /**
     * Get Games from Owner
     * @summary Get Games from Owner
     */
    @SuccessResponse(200, "Found Game Details")
    @Response<APIError>(400, "Unparsable ID")
    @Get("/owned/{ownerId}")
    public async getGamesByOwner(@Path() ownerId: number): Promise<Array<Game & { rating: number, difficulty: number, rating_count: number }>> {
        this.setStatus(200);
        return await datastore.getGamesByOwner(ownerId);
    }

    /**
     * Get Favorites List Contents
     * @summary Get Favorites List Contents
     */
    @SuccessResponse(200, "Found")
    @Get("favorites/{uid}")
    public async getFavoritesListGames(
        @Path() uid: number,
    ): Promise<
        Array<{
            gameId: number;
            gameName: string;
            difficulty: number;
            rating: number;
        }>
    > {
        this.setStatus(200);
        return await datastore.getUserFavorites(uid);
    }

    /**
     * Get Clear List Contents
     * @summary Get Clear List Contents
     */
    @SuccessResponse(200, "Found")
    @Get("clears/{uid}")
    public async getClearListGames(
        @Path() uid: number,
    ): Promise<
        Array<{
            gameId: number;
            gameName: string;
            difficulty: number;
            rating: number;
        }>
    > {
        this.setStatus(200);
        return await datastore.getUserClears(uid);
    }
}
