import datastore from "./datastore";
import { Controller, Get, Tags, Query, Route, SuccessResponse, Header, Response, Path } from "tsoa";
import { GetGamesParms } from "./model/GetGamesParms";
import whitelist from "./lib/whitelist";
import { Game } from "./model/Game";
import { Review } from "./model/Review";
import { Screenshot } from "./model/Screenshot";
import { AuthResponse } from "./auth-router";
import { GetUsersParms } from "./model/GetUsersParms";
import { APIError } from "./model/response/error";
import { Database } from "./database";
import * as jwt from "jsonwebtoken";
import Config from "./model/config";
let config: Config = require("./config/config.json");

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

interface GameExtTag {
    name: string;
    id: number;
    count: number;
}

interface GameExt extends Game {
    ratings: {
        rating: number;
        difficulty: number;
    };
    reviews: Review[];
    tags: GameExtTag[];
    screenshots: Screenshot[];
}

interface UserExt extends Omit<AuthResponse, "email" | "banned" | "phash2" | "isAdmin"> {
    reviewCount: number;
    ratingsCount: number;
    screenshotCount: number;
    isFollowing: boolean;
}

@Route("/composite")
@Tags("Composite")
export class CompositeController extends Controller {
    /**
     * Get Game
     * @summary Get Game
     */
    @Tags("Games")
    @SuccessResponse(200, "Found Extended Game Details")
    @Response<APIError>(400, "Unparsable ID")
    @Response(404, "Not Found")
    @Get("games/{id}/all")
    public async getGameCompositeAll(@Path() id: string): Promise<GameExt> {
        // TODO: this could be simplified by making id optional, and where it isn't provided, assume "random"
        let game: GameExt;
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

        const [ratings, reviews, tags, screenshots] = await Promise.all([
            datastore.getRatings(game.id),
            datastore.getReviews({
                game_id: game.id,
                page: 0,
                limit: 5, // just enough to hydrate a page
                textReviewsFirst: true,
                includeOwnerReview: true,
            }),
            datastore.getTagSetsForGame(game.id),
            datastore.getScreenshots({ gameId: game.id }),
        ]);
        game.ratings = ratings;
        game.reviews = reviews;
        game.tags = tags as unknown as ReadonlySet<{ name: string; id: number; count: number }>;
        game.screenshots = screenshots;

        return game;
    }

    /**
     * Game List
     * @summary Game List
     */
    @Tags("Games")
    @SuccessResponse(200, "List of Games matching filters")
    @Response<APIError>(400, "Invalid Parameters")
    @Get("games/rating")
    public async getGamesWithRatings(
        @Header("Authorization") authorization?: string,
        @Query() q?: string,
        @Query() id?: number,
        @Query() removed?: boolean,
        @Query() name?: string,
        @Query() tags?: string,
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
    ): Promise<GameExt[]> {
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

        if (tags) {
            try {
                params.tags = <string[]>JSON.parse(tags);
                params.tags.forEach((s, i) => {
                    if (+s === NaN) throw "tag #" + i + " was not a number -> " + s;
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

        const rows: GameExt[] = await datastore.getGames(params);
        // TODO: remove and replicate elsewhere.
        // The only reason I'm leaving it around is because
        // I want to implement this feature correctly. My hope is by
        // documenting what this feature is supposed to do, that I can
        // do it correctly later. This feature is "supposed" to give
        // you the total count of games from a query, especially if it
        // goes over page limits, so you can know how many times you might
        // need to call it again to get every matching row. Unfortunately,
        // at the time, this meant running the query again, without limits,
        // and counting that, which is, obviously, too costly. So it's been
        // commented out, but left in the source code for brevity sake.
        /*if (!params.page) {
            const total = await datastore.countGames(params);
            this.setHeader("total-count", total);
        }*/

        for (const row of rows) {
            row.ratings = await datastore.getRatings(row.id);
        }

        return rows;
    }

    /**
     * Get User
     * @summary Get User
     */
    @Tags("Users")
    @SuccessResponse(200, "Found Extended User Details")
    @Response<APIError>(400, "Unparsable ID")
    @Response(404, "Not Found")
    @Get("users/{id}/all")
    public async getUserCompositeAll(
        @Path() id: number,
        @Header("Authorization") authorization?: string,
    ): Promise<UserExt> {
        const params = { id, page: 0, limit: 1 } as GetUsersParms;
        const users: AuthResponse[] | null = await datastore.getUsers(params);
        if (users === null || users.length === 0) {
            this.setStatus(404);
            return { error: "not found" } satisfies APIError;
        }
        const user: UserExt = (() => {
            const user = users[0];
            // DANGER: we really need a User model
            delete user.banned;
            delete user.email;
            delete user.phash2;
            delete user.isAdmin;
            return user;
        })();

        const [reviewCount, ratingsCount, screenshotCount, isFollowing] = await Promise.all([
            datastore.getUserReviewCount(id),
            datastore.getUserRatingCount(id),
            datastore.getUserScreenshotCount(id),
            (async (): Promise<boolean> => {
                if (!authorization) {
                    return null;
                }
                try {
                    const reqUser = extractBearerJWT(authorization);

                    const db = new Database();
                    const queryRes: [{ is_following: boolean }] = await db.query(
                        "SELECT IF(EXISTS(SELECT 1 FROM `UserFollow` WHERE `user_id` = ? AND `user_follow_id` = ?), TRUE, FALSE) AS is_following",
                        [Number(user.id), Number(reqUser.sub)],
                    );
                    return Boolean(queryRes[0].is_following);
                } catch (e) {
                    console.error(e);
                    return false;
                }
            })(),
        ]);

        user.reviewCount = reviewCount;
        user.ratingsCount = ratingsCount;
        user.screenshotCount = screenshotCount;
        user.isFollowing = isFollowing;

        return user;
    }

    /**
     * User List
     * @summary User List
     */
    @Tags("Users")
    @SuccessResponse(200, "List of users matching filters")
    @Get("users")
    public async getUsersWithReviewsCount(
        @Header("Authorization") authorization?: string,
        @Query() name?: string,
        @Query() following?: boolean,
        @Query() banned?: boolean,
        @Query() page?: number = 0,
        @Query() limit?: number = 50,
        @Query() orderCol?: string,
        @Query() orderDir?: "ASC" | "DESC",
    ): Promise<Array<Omit<UserExt, "ratingsCount" | "screenshotCount">>> {
        const params: GetUsersParms = { page, limit, orderCol, orderDir };
        if (name) params.name = name;

        const [users, reviewCounts] = await (async () => {
            const users: ReadonlyArray<AuthResponse> = await datastore.getUsers(params);
            const dbQueries: Array<Promise<number>> = new Array(users.length);

            let idx = 0;
            for (const user of users) {
                dbQueries[idx] = datastore.getUserReviewCount(user.id);
                // DANGER: where's my user model
                delete user.email;
                delete user.banned;
                delete user.phash2;
                delete user.isAdmin;

                ++idx;
            }

            const reviewCounts = (await Promise.all(dbQueries)).reverse();

            return [users as unknown as Array<Omit<UserExt, "ratingsCount" | "screenshotCount">>, reviewCounts];
        })();

        for (const user of users) {
            user.reviewCount = reviewCounts.pop();
        }

        return users;
    }
}
