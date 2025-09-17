import datastore from "./datastore";
import express from "express";
import handle from "./lib/express-async-catch";
import { userCheck } from "./lib/auth-check";
import {
    Body,
    Controller,
    Delete,
    Get,
    Header,
    Patch,
    Path,
    Put,
    Query,
    Response,
    Route,
    Security,
    SuccessResponse,
    Tags,
} from "tsoa";
import { Review } from "./model/Review";

const app = express.Router();
export default app;

import Config from "./model/config";
let config: Config = require("./config/config.json");

import * as jwt from "jsonwebtoken";
import { GetReviewOptions } from "./model/GetReviewOptions";
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

@Tags("Reviews")
@Route("reviews")
export class ReviewController extends Controller {
    /**
     * Get Review
     * @summary Get Review
     */
    @SuccessResponse(200, "Review Details")
    @Response<void>(400, "Not Found")
    @Get("{id}")
    public async getReview(@Path() id: number): Promise<Review> {
        const review = await datastore.getReview(id);
        if (review == null) return this.setStatus(404);
        return review;
    }

    /**
     * Get List of Reviews
     * @summary Get List of Reviews
     */
    @SuccessResponse(200, "List of matching Reviews")
    @Get()
    public async getReviews(
        @Query() gameId?: number,
        @Query() userId?: number,
        @Query() id?: number,
        @Query() page: number = 0,
        @Query() limit: number = 50,
        @Query() textReviewsFirst: boolean = false,
        @Query() includeOwnerReview: boolean = false,
        @Query() removed: boolean = false,
        @Query() orderCol?: string,
        @Query() orderDir?: "ASC" | "DESC",
    ): Promise<Review[]> {
        // TODO: allow admins to toggle removed reviews
        const params: GetReviewOptions = {
            game_id: gameId,
            user_id: userId,
            id,
            page,
            limit,
            textReviewsFirst,
            includeOwnerReview,
            removed,
            orderCol,
            orderDir,
        };
        params.removed = false;
        params.page = params.page ?? 0;
        params.limit = params.limit ?? 50;
        const rows = await datastore.getReviews(params);
        return rows;
    }

    /**
     * Update Review (User Only)
     * @summary Update Review (User Only)
     */
    @Security("bearerAuth", ["user"])
    @SuccessResponse(204, "Successfully Updated")
    @Response<void>(403, "Bad Ownership")
    @Response<void>(400, "Not Found")
    @Patch("{id}")
    public async patchReview(
        @Header("Authorization") authorization: string,
        @Path() id: number,
        @Body() requestBody: Review,
    ): Promise<void> {
        // NOTE: auth guard should make the error condition unreachable
        const user = extractBearerJWT(authorization);

        const isAdmin = user.isAdmin;

        const ogReview = await datastore.getReview(+id);
        if (ogReview === null) return this.setStatus(404);

        const isReviewer = +ogReview.user_id! == +user.sub;

        if (!isAdmin && !isReviewer) return this.setStatus(403);

        const review = requestBody;
        review.id = +id;

        if (!isAdmin && !isReviewer) {
            delete review.removed;
        }

        await datastore.updateReview(review);
        return this.setStatus(204);
    }

    /**
     * Like Review (User/Admin Only)
     * @summary Like Review (User/Admin Only)
     */
    @Security("bearerAuth", ["user"])
    @SuccessResponse(204, "Like Accepted")
    @Response<void>(403, "Bad Ownership")
    @Response<void>(404, "Not Found")
    @Put("{id}/likes/{userId}")
    public async putReviewLike(
        @Header("Authorization") authorization: string,
        @Path() id: number,
        @Path() userId: number,
    ): Promise<void> {
        // NOTE: auth guard should make the error condition unreachable
        const user = extractBearerJWT(authorization);

        if (user.sub != userId) return this.setStatus(403);

        const ogReview = await datastore.getReview(+id);
        if (ogReview === null) return this.setStatus(404);

        await datastore.addLikeToReview(+id, userId);
        return this.setStatus(204);
    }

    /**
     * Unlike Review (User/Admin Only)
     * @summary Unlike Review (User/Admin Only)
     */
    @Security("bearerAuth", ["user"])
    @SuccessResponse(204, "Unlike Accepted")
    @Response<void>(403, "Bad Ownership")
    @Response<void>(404, "Not Found")
    @Delete("{id}/likes/{userId}")
    public async deleteReviewLike(
        @Header("Authorization") authorization: string,
        @Path() id: number,
        @Path() userId: number,
    ): Promise<void> {
        // NOTE: auth guard should make the error condition unreachable
        const user = extractBearerJWT(authorization);

        if (user.sub != userId) return this.setStatus(403);

        const ogReview = await datastore.getReview(+id);
        if (ogReview === null) return this.setStatus(404);

        await datastore.removeLikeFromReview(+id, userId);
        return this.setStatus(204);
    }

    /**
     * Returns whether a user likes a specific review. (User/Admin Only)
     * @summary Like Check for User (User/Admin Only)
     */
    @Security("bearerAuth", ["user"])
    @SuccessResponse(200, "Predicate")
    @Response<void>(403, "Bad Ownership")
    @Response<void>(404, "Not Found")
    @Get("{id}/likes/{userId}")
    public async getReviewLike(
        @Header("Authorization") authorization: string,
        @Path() id: number,
        @Path() userId: number,
    ): Promise<boolean> {
        // NOTE: auth guard should make the error condition unreachable
        const user = extractBearerJWT(authorization);

        if (user.sub != userId) return this.setStatus(403);

        const ogReview = await datastore.getReview(+id);
        if (ogReview === null) return this.setStatus(404);

        const liked = await datastore.isLiked(+id, userId);
        return liked;
    }
}
