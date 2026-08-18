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
	Request,
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
import type { RequestExt } from "../model/app/request";
import type { Game } from "../model/Game";
import type { APIError } from "../model/response/error";

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

	/**
	 * Add Game to Bookmarks
	 * @summary Add Game to Bookmarks
	 */
	@Security("bearerAuth", ["user"])
	@SuccessResponse(204, "Bookmarked")
	@Put("bookmark/{gid}")
	public async putBookmarkGame(
		@Request() req: RequestExt,
		@Header("Authorization") authorization: string,
		@Path() gid: number,
	): Promise<void> {
		await datastore.bookmarkGame(Number(req.app_user.sub), gid);
		this.setStatus(204);
		return;
	}

	/**
	 * Check if User has Game bookmarked
	 * @summary Check if User has a Game bookmarked
	 */
	@Security("bearerAuth", ["user"])
	@SuccessResponse(200, "Bookmarked")
	@Get("bookmark/{gid}")
	public async getIsGameBookmarked(
		@Request() req: RequestExt,
		@Header("Authorization") authorization: string,
		@Path() gid: number,
	): Promise<boolean> {
		this.setStatus(200);
		return datastore.isUserBookmarking(Number(req.app_user.sub), gid);
	}

	/**
	 * Remove a Game from being bookmarked
	 * @summary Remove a Game from being bookmarked
	 */
	@Security("bearerAuth", ["user"])
	@SuccessResponse(204, "Bookmark Removed")
	@Delete("bookmark/{gid}")
	public async deleteBookmarkedGame(
		@Request() req: RequestExt,
		@Header("Authorization") authorization: string,
		@Path() gid: number,
	): Promise<void> {
		this.setStatus(204);
		await datastore.unbookmarkGame(Number(req.app_user.sub), gid);
		return;
	}

	/**
	 * Add Game to Favorites
	 * @summary Add Game to Favorites
	 */
	@Security("bearerAuth", ["user"])
	@SuccessResponse(204, "Favorited")
	@Put("favorite/{gid}")
	public async putFavoriteGame(
		@Request() req: RequestExt,
		@Header("Authorization") authorization: string,
		@Path() gid: number,
	): Promise<void> {
		await datastore.favoriteGame(Number(req.app_user.sub), gid);
		this.setStatus(204);
		return;
	}

	/**
	 * Check if User has Game favorited
	 * @summary Check if User has a Game favorited
	 */
	@Security("bearerAuth", ["user"])
	@SuccessResponse(200, "Favorited")
	@Get("favorite/{gid}")
	public async getIsGameFavorited(
		@Request() req: RequestExt,
		@Header("Authorization") authorization: string,
		@Path() gid: number,
	): Promise<boolean> {
		this.setStatus(200);
		return datastore.isUserFavoriting(Number(req.app_user.sub), gid);
	}

	/**
	 * Remove a Game from being favorited
	 * @summary Remove a Game from being favorited
	 */
	@Security("bearerAuth", ["user"])
	@SuccessResponse(204, "Favorite Removed")
	@Delete("favorite/{gid}")
	public async deleteFavoritedGame(
		@Request() req: RequestExt,
		@Header("Authorization") authorization: string,
		@Path() gid: number,
	): Promise<void> {
		this.setStatus(204);
		datastore.unfavoriteGame(Number(req.app_user.sub), gid);
		return;
	}

	/**
	 * Add Game to Clear
	 * @summary Add Game to Clear
	 */
	@Security("bearerAuth", ["user"])
	@SuccessResponse(204, "Cleared")
	@Put("clear/{gid}")
	public async putClearGame(
		@Request() req: RequestExt,
		@Header("Authorization") authorization: string,
		@Path() gid: number,
	): Promise<void> {
		await datastore.clearGame(Number(req.app_user.sub), gid);
		this.setStatus(204);
		return;
	}

	/**
	 * Check if User has Game cleared
	 * @summary Check if User has a Game cleared
	 */
	@Security("bearerAuth", ["user"])
	@SuccessResponse(200, "Cleared")
	@Get("clear/{gid}")
	public async getIsGameCleared(
		@Request() req: RequestExt,
		@Header("Authorization") authorization: string,
		@Path() gid: number,
	): Promise<boolean> {
		this.setStatus(200);
		return datastore.isUserCleared(Number(req.app_user.sub), gid);
	}

	/**
	 * Remove a Game from being cleared
	 * @summary Remove a Game from being cleared
	 */
	@Security("bearerAuth", ["user"])
	@SuccessResponse(204, "Clear Removed")
	@Delete("clear/{gid}")
	public async deleteClearedGame(
		@Request() req: RequestExt,
		@Header("Authorization") authorization: string,
		@Path() gid: number,
	): Promise<void> {
		this.setStatus(204);
		datastore.unclearGame(Number(req.app_user.sub), gid);
		return;
	}

	/**
	 * Get Bookmark List Contents
	 * @summary Get Bookmark List Contents
	 */
	@SuccessResponse(200, "Found")
    @Get("bookmarks")
    public async getBookmarkedGames(
        @Request() req: RequestExt,
    ): Promise<
        Array<{
            gameId: number;
            gameName: string;
            difficulty: number;
            rating: number;
        }>
    > {
        this.setStatus(200);
        return await datastore.getUserBookmarks(Number(req.app_user.sub))
    }

	/**
	 * Get Following List Contents
	 * @summary Get Following List Contents
	 */
	@SuccessResponse(200, "Found")
    @Get("following")
    public async getFollowingUsers(
        @Request() req: RequestExt,
    ): Promise<
        Array<{
            userId: number;
            name: string;
        }>
    > {
        this.setStatus(200);
        return await datastore.getUserFollowing(Number(req.app_user.sub))
    }
}
