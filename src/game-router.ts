import express from "express";
import datastore from "./datastore";
import { GetGamesParms } from "./model/GetGamesParms";
import { GetScreenshotParms } from "./model/GetScreenshotParms";
import { Screenshot } from "./model/Screenshot";
import { Game } from "./model/Game";
import whitelist from "./lib/whitelist";

import * as Minio from "minio";

import multer from "multer";
import handle from "./lib/express-async-catch";
import { adminCheck, userCheck } from "./lib/auth-check";
import Config from "./model/config";
let config: Config = require("./config/config.json");

import { Permission, hasPermission } from "./model/Permission";
import {
    Body,
    Controller,
    Delete,
    FormField,
    Get,
    Header,
    Patch,
    Path,
    Post,
    Put,
    Query,
    Response,
    Route,
    Security,
    SuccessResponse,
    Tags,
    UploadedFile,
} from "tsoa";
const upload = multer({
    storage: multer.diskStorage({
        //If no destination is given, the operating system's default directory for temporary files is used.
        filename: function(req, file, cb) {
            cb(null, file.fieldname + "-" + Date.now());
        },
    }),
});
console.log("config:");
console.log(config);
const minioClient = new Minio.Client(config.s3);

const app = express.Router();
export default app;

import * as jwt from "jsonwebtoken";
import { Review } from "./model/Review";
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

export interface Rating {
    rating: number;
    difficulty: number;
}

interface APIError {
    error: string;
}

@Route("games")
@Tags("Games")
export class GameController extends Controller {
    /**
     * Add Game (Admin Only)
     * @summary Add Game (Admin Only)
     */
    @Security("bearerAuth", ["admin"])
    @SuccessResponse(200, "Populated Game Object")
    @Response<APIError>(403, "Insufficient Privileges")
    @Post()
    public async postGame(
        @Header("Authorization") authorization: string,
        @Body() requestBody: Pick<Game, "name" | "url" | "urlSpdrn" | "author" | "collab" | "dateCreated" | "ownerId">,
    ): Promise<Game> {
        const user = extractBearerJWT(authorization);

        const uid = user.sub;

        const game = await datastore.addGame(requestBody, uid);

        datastore.addReport(
            {
                type: "game_add",
                targetId: "" + game.id,
                report: "Game added",
            },
            user.sub,
        );

        this.setStatus(201);
        return game;
    }

    /**
     * Game List
     * @summary Game List
     */
    @SuccessResponse(200, "List of Games matching filters")
    @Response<APIError>(400, "Invalid Parameters")
    @Get()
    public async getGames(
        @Header("Authorization") authorization?: string,
        @Query() q?: string,
        @Query() id?: number,
        @Query() removed?: boolean,
        @Query() name?: string,
        @Query() nameStartsWith?: string,
        @Query() nameExp?: string,
        @Query() tags?: string, // QUEST: find a way to stuff a array in a querystring
        @Query() author?: string,
        @Query() ownerUserId?: number,
        @Query() hasDownload?: boolean,
        @Query() createdFrom?: Date,
        @Query() createdTo?: Date,
        @Query() clearedByUserId?: number,
        @Query() reviewedByUserId?: number,
        @Query() ratingFrom?: number,
        @Query() ratingTo?: number,
        @Query() difficultyFrom?: number,
        @Query() difficultyTo?: number,
        @Query() page?: number,
        @Query() limit?: number,
        @Query() order_col?: string,
        @Query() order_dir?: string,
    ): Promise<Game[]> {
        // TODO: do type restrictions in method definition
        order_col = whitelist(order_col, ["name", "date_created", "rating", "difficulty"], "name");
        order_dir = whitelist(order_dir, ["asc", "desc"], "asc") as "asc" | "desc";
        let isAdmin = false;
        try {
            const user = extractBearerJWT(authorization);
            isAdmin = user.isAdmin;
        } catch (_) {
            console.warn("user provided authorization, but it was invalid");
        }

        const params: GetGamesParms = {
            page: +(page || 0),
            limit: +(limit || 50),
            orderCol: order_col,
            orderDir: order_dir,
        };
        if (!isAdmin) params.removed = false;

        params.q = q; // QUEST: what the hell is Q?
        params.id = id;
        params.removed = false; // QUEST: shouldn't this just use the removed query parameter?
        params.name = name;
        params.nameStartsWith = nameStartsWith;
        params.nameExp = nameExp;

        if (tags) {
            try {
                const tagNames = tags.trim().split(",");
                params.tags = (await datastore.getTagsByName(tagNames)).flatMap((v, idx, a) => {
                    return String(v.id);
                });
                params.tags.forEach((s, i) => {
                    if (Number(s) === NaN) throw "tag #" + i + " was not a number -> " + s;
                });
            } catch (e) {
                this.setStatus(400);
                return { error: "tags must be an array of numbers" };
            }
        }
        params.author = author;
        params.hasDownload = hasDownload;
        params.createdFrom = createdFrom?.toString();
        params.createdTo = createdTo?.toString();
        params.clearedByUserId = clearedByUserId;
        params.reviewedByUserId = reviewedByUserId;

        params.ratingFrom = ratingFrom;
        params.ratingTo = ratingTo;
        params.difficultyFrom = difficultyFrom;
        params.difficultyTo = difficultyTo;
        params.ownerUserId = ownerUserId;

        const rows = await datastore.getGames(params);
        if (!params.page) {
            const total = await datastore.countGames(params);
            this.setHeader("total-count", total);
        }

        return rows;
    }

    /**
     * Get Game
     * @summary Get Game
     */
    @SuccessResponse(200, "Found Game Details")
    @Response<APIError>(400, "Unparsable ID")
    @Response(404, "Not Found")
    @Get("{id}")
    public async getGame(@Path() id: string): Promise<Game> {
        // TODO: this could be simplified by making id optional, and where it isn't provided, assume "random"
        let game;
        if (id === "random") {
            game = await datastore.getRandomGame();
        } else if (!isNaN(+id)) {
            const game_id = parseInt(id, 10);
            game = await datastore.getGame(game_id);
        } else {
            this.setStatus(400);
            return { error: "id must be a number" };
        }

        if (!game) {
            this.setStatus(404);
            return;
        }

        //get owner review
        if (game.ownerId) {
            const ownerReviews = await datastore.getReviews({
                game_id: game.id,
                user_id: +game.ownerId,
                includeOwnerReview: true,
                removed: false,
            });
            if (ownerReviews.length == 1) {
                game.ownerBio = ownerReviews[0];
            }
        }

        return game;
    }

    /**
     * Remove Game. This is idempotent - repeated deletions of the same game have no effect.
     * @summary Remove Game (Admin Only)
     */
    @Security("bearerAuth", ["admin"])
    @SuccessResponse(204, "Game Details")
    @Response<APIError>(403, "Insufficient Privileges")
    @Response(404, "Not Found")
    @Delete("{id}")
    public async deleteGame(@Header("Authorization") authorization: string, @Path() id: number): Promise<Game | void> {
        // NOTE: auth guard should make the error condition unreachable
        const user = extractBearerJWT(authorization);

        let game = await datastore.getGame(id);

        if (!game) return this.setStatus(404);
        game = game!;

        if (game.removed) return this.setStatus(204);

        let gamePatch: Game = {
            id: +id,
            removed: true,
        };
        const success = await datastore.updateGame(gamePatch, user.isAdmin);
        if (!success) return this.setStatus(404);

        datastore.addReport(
            {
                type: "game_remove",
                targetId: "" + game.id,
                report: "Game removed",
            },
            user.sub,
        );

        return this.setStatus(204);
    }

    /**
     * Get Reviews for Game
     * @summary Get Reviews for Game
     */
    @SuccessResponse(200, "List of Reviews for the game")
    @Response<APIError>(400, "Invalid Game ID")
    @Response<APIError>(404, "Game Not Found")
    @Tags("Reviews")
    @Get("{id}/reviews")
    public async getGameReviews(
        @Path() id: number,
        @Query() byUserId?: number,
        @Query() includeOwnerReview?: boolean,
        @Query() textReviewsFirst?: boolean,
        @Query() page?: number = 0,
        @Query() limit?: number = 50,
    ): Promise<Review[]> {
        if (isNaN(+id)) {
            this.setStatus(400);
            return { error: "id must be a number" };
        }

        const game = await datastore.gameExists(id);
        if (!game) {
            this.setStatus(404);
            return { error: "no game with this id currently exists" };
        }

        const rows = await datastore.getReviews({
            game_id: id,
            user_id: byUserId,
            includeOwnerReview: includeOwnerReview,
            textReviewsFirst: textReviewsFirst,
            page: page,
            limit: limit,
            removed: false, // TODO: admins should be able to query these
        });

        return rows;
    }

    /**
     * Add Review for Game (User/Admin Only)
     * @summary Add Review for Game (User/Admin Only)
     */
    @Tags("Reviews")
    @Security("bearerAuth", ["user"])
    @SuccessResponse(200, "Review with additional populated fields")
    @Response<APIError>(400, "Invalid Game ID")
    @Response<APIError>(401, "Unauthorized")
    @Response<APIError>(404, "Game Not Found")
    @Put("{id}/reviews")
    public async putGameReview(
        @Header("Authorization") authorization: string,
        @Path() id: number,
        @Body() requestBody: Review,
    ): Promise<Review> {
        // NOTE: auth guard should make the error condition unreachable
        const user = extractBearerJWT(authorization);

        if (isNaN(+id)) {
            this.setStatus(400);
            return { error: "id must be a number" };
        }

        const game = await datastore.gameExists(id);
        if (!game) {
            this.setStatus(404);
            return { error: "no game with this id currently exists" };
        }

        if (requestBody.rating) {
            requestBody.rating = Math.min(Math.max(requestBody.rating, 0), 100);
        }
        if (requestBody.difficulty) {
            requestBody.difficulty = Math.min(Math.max(requestBody.difficulty, 0), 100);
        }

        const newReview = await datastore.addReview(requestBody, id, user.sub);
        return newReview;
    }

    /**
     * Get Screenshots for Game
     * @summary Get Screenshots for Game
     */
    @Tags("Screenshots")
    @SuccessResponse(200, "List of screenshots for the game")
    @Response<APIError>(400, "Invalid Game ID")
    @Response<APIError>(404, "Game Not Found")
    @Get("{id}/screenshots")
    public async getGameScreenshot(
        @Header("Authorization") authorization?: string,
        @Path() id: number,
        @Query() approved?: boolean,
        @Query() page?: number = 0,
        @Query() limit?: number = 50,
    ): Promise<Screenshot[]> {
        const isAdmin = false;
        if (authorization) {
            try {
                const user = extractBearerJWT(authorization);
                isAdmin = user && user.isAdmin;
            } catch (_) {
                console.warn("user provided authorization, but it was invalid");
            }
        }

        if (isNaN(+id)) {
            this.setStatus(400);
            return { error: "id must be a number" };
        }

        const game = await datastore.gameExists(id);
        if (!game) {
            this.setStatus(404);
            return { error: "no game with this id currently exists" };
        }

        if (!isAdmin) approved = true; //only return approved screenshots

        let parms: GetScreenshotParms = { id, page, limit, approved };
        if (!isAdmin) parms.removed = false;
        const rows = await datastore.getScreenshots(parms);

        return rows;
    }

    /**
     * Add Screenshot for Game (User/Admin Only)
     * @summary Add Screenshot for Game (User/Admin Only)
     */
    @Security("bearerAuth", ["user"])
    @Tags("Screenshots")
    @SuccessResponse(200, "Populated Screenshot Details")
    @Response<APIError>(400, "Invalid Game ID")
    @Response<APIError>(401, "Unauthorized")
    @Response<APIError>(404, "Game Not Found")
    @Post("{id}/screenshots")
    public async postGameScreenshot(
        @Header("Authorization") authorization: string,
        @Path() id: number,
        @FormField() description?: string = "",
        @UploadedFile() screenshot: Express.Multer.File,
    ): Promise<Screenshot> {
        console.log(screenshot);
        // NOTE: auth guard should make the error condition unreachable
        const user = extractBearerJWT(authorization);

        if (isNaN(+id)) {
            this.setStatus(400);
            return { error: "id must be a number" };
        }
        const permissions = await datastore.getPermissions(user.sub);
        const autoApprove = hasPermission(permissions, Permission.AUTO_APPROVE_SCREENSHOT);
        const canScreenshot = hasPermission(permissions, Permission.CAN_SCREENSHOT);
        if (!canScreenshot) {
            this.setStatus(403);
            return { error: "screenshot capability revoked" };
        }

        const game = await datastore.gameExists(id);
        if (!game) {
            this.setStatus(404);
            return { error: "no game with this id currently exists" };
        }
        const ss: Screenshot = {
            gameId: +id,
            description: description,
        };

        const ssres = await datastore.addScreenshot(ss, user.sub, autoApprove);

        //TODO: stream images straight into s3 via multer-s3 storage?
        var metaData = {
            "Content-Type": "image/png",
            "X-Amz-Meta-Testing": 1234,
            gameId: ssres.gameId,
            id: ssres.id,
        };
        // Using fPutObject API upload your file to the bucket europetrip.
        minioClient.putObject(config.s3_bucket, `${ssres.id}.png`, screenshot.buffer, metaData, function(err, etag) {
            // TODO: don't return raw S3 errors to the user!!!
            if (err) return console.log(err);
        });

        if (autoApprove) {
            datastore.addReport(
                {
                    type: "screenshot",
                    targetId: "" + ssres.id,
                    report: "Screenshot added, automatically approved",
                },
                user.sub,
            );
        } else {
            datastore.addReport(
                {
                    type: "screenshot",
                    targetId: "" + ssres.id,
                    report: "Screenshot added, awaiting approval",
                },
                user.sub,
            );
        }

        return ssres;
    }

    /**
     * Get Tags Associated to Game
     * @summary Get Tags Associated to Game
     */
    @Get("{id}/tags")
    @SuccessResponse(200, "List of tags for the game")
    @Response<APIError>(400, "Invalid Game ID")
    @Response<APIError>(404, "Game Not Found")
    // TODO: add a game tag type
    public async getGameTags(@Path() id: number, @Query() userId?: number): Promise<any | any[]> {
        if (isNaN(+id)) {
            this.setStatus(400);
            return { error: "id must be a number" };
        }

        const game = await datastore.gameExists(id);
        if (!game) {
            this.setStatus(404);
            return { error: "no game with this id currently exists" };
        }

        const tags = await datastore.getTagsForGame(id, userId);
        return tags;
    }

    /**
     * Clears and sets an array of tag IDs for a game on a user-by-user basis.
     * @summary Set Tags Associated to Game
     */
    @Security("bearerAuth", ["user"])
    @SuccessResponse(200, "Full list of tags for the game")
    @Response<APIError>(400, "Invalid Game ID")
    @Response<APIError>(401, "Unauthorized")
    @Response<APIError>(404, "Game Not Found")
    @Post("{id}/tags")
    public async postGameSetTags(
        @Header("Authorization") authorization: string,
        @Path() id: number,
        @Body() requestBody: any[],
    ): Promise<any | any[]> {
        // NOTE: auth guard should make the error condition unreachable
        const user = extractBearerJWT(authorization);

        if (isNaN(+id)) {
            this.setStatus(400);
            return { error: "id must be a number" };
        }

        const game = await datastore.gameExists(id);
        if (!game) {
            this.setStatus(404);
            return { error: "no game with this id currently exists" };
        }

        if (!(requestBody instanceof Array)) {
            this.setStatus(400);
            return { error: "invalid body: expected array of tag ids" };
        }

        if (requestBody.length > 0) {
            const tagsok = await datastore.tagsExist(requestBody);
            console.log(tagsok);
            if (!tagsok) {
                this.setStatus(400);
                return { error: "invalid body: all tag ids must exist" };
            }
        }

        await datastore.setTags(id, user.sub, requestBody);

        const tags = await datastore.getTagsForGame(id);
        return tags;
    }

    /**
     * Update Game (Admin Only)
     * @summary Update Game (Admin Only)
     */
    @Security("bearerAuth", ["admin"])
    @SuccessResponse(200, "Game with populated details")
    @Response<APIError>(400, "Invalid Game ID")
    @Response<APIError>(403, "Insufficient Privileges")
    @Patch("{id}")
    public async patchGame(
        @Header("Authorization") authorization: string,
        @Path() id: number,
        @Body() game: Game,
    ): Promise<Game> {
        // NOTE: auth guard should make the error condition unreachable
        const user = extractBearerJWT(authorization);

        if (isNaN(+id)) {
            this.setStatus(400);
            return { error: "id must be a number" };
        }

        game.id = id;

        const gameFound = await datastore.updateGame(game, user.isAdmin);
        if (!gameFound) {
            this.setStatus(404);
            return { error: "no game with this id currently exists" };
        }

        const newGame = await datastore.getGame(id);
        if (newGame == null) {
            this.setStatus(404);
            return { error: "no game with this id currently exists" };
        }

        datastore.addReport(
            {
                type: "game_update",
                targetId: "" + game.id,
                report: "Game updated",
            },
            user.sub,
        );

        return newGame;
    }

    /**
     * Get Ratings for Game
     * @summary Get Ratings for Game
     */
    @SuccessResponse(200, "Rating for Game")
    @Response<APIError>(400, "Invalid Game ID")
    @Response<APIError>(404, "Game Not Found")
    @Tags("Ratings")
    @Get("{id}/ratings")
    public async getGameRatings(@Path() id: number): Promise<Rating> {
        if (isNaN(+id)) {
            this.setStatus(400);
            return { error: "id must be a number" };
        }

        const game = await datastore.gameExists(id);
        if (!game) {
            this.setStatus(404);
            return { error: "no game with this id currently exists" };
        }

        return await datastore.getRatings(id);
    }
}
