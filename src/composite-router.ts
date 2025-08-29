import datastore from "./datastore";
import { Controller, Get, Tags, Query, Route, SuccessResponse, Security, Header, Response, Path } from "tsoa";
import { GetGamesParms } from "./model/GetGamesParms";
import whitelist from "./lib/whitelist";
import { Game } from "./model/Game";
import { Review } from "./model/Review";
import { Screenshot } from "./model/Screenshot";

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

interface APIError {
    error: string;
}

interface GameExt extends Game {
    ratings: {
        rating: number;
        difficulty: number;
    };
    reviews: Review[];
    tags: string[];
    screenshots: Screenshot[];
}

@Route("/games/composite")
@Tags("Composite", "Games")
export class CompositeController extends Controller {
    /**
     * Get Game
     * @summary Get Game
     */
    @SuccessResponse(200, "Found Game Details")
    @Response<APIError>(400, "Unparsable ID")
    @Response(404, "Not Found")
    @Get("{id}/all")
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
            datastore.getReviews({ game_id: game.id, page: 0, limit: 5, textReviewsFirst: true }), // just enough to hydrate a page
            datastore.getTagsForGame(game.id, void 0),
            datastore.getScreenshots({ gameId: game.id }),
        ]);
        game.ratings = ratings;
        game.reviews = reviews;
        game.tags = tags;
        game.screenshots = screenshots;

        return game;
    }

    /**
     * Game List
     * @summary Game List
     */
    @SuccessResponse(200, "List of Games matching filters")
    @Response<APIError>(400, "Invalid Parameters")
    @Get("rating")
    public async getGamesWithRatings(
        @Header("Authorization") authorization?: string,
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

        //params.q = req.query.q; // QUEST: what the hell is Q?
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
        if (!params.page) {
            const total = await datastore.countGames(params);
            this.setHeader("total-count", total);
        }

        for (const row of rows) {
            row.ratings = await datastore.getRatings(row.id);
        }

        return rows;
    }
}
