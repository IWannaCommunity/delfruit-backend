import express from "express";
import datastore from "./datastore";
import AuthModule from "./lib/auth";
import { GetUsersParms } from "./model/GetUsersParms";
import handle from "./lib/express-async-catch";
import { userCheck } from "./lib/auth-check";
import { recaptchaVerify } from "./auth-router";
import { Permission } from "./model/Permission";
import moment from "moment";
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
    Query,
    Response,
    Route,
    Security,
    SuccessResponse,
    Tags,
} from "tsoa";
import Config from "./model/config";
let config: Config = require("./config/config.json");
const auth = new AuthModule();
const app = express.Router();
export default app;

interface UserRegistration {
    username: string;
    password: string;
    email: string;
}

interface EditUserPermissionsParam {
    revokedUntil: Date;
}

import * as jwt from "jsonwebtoken";
import { Review } from "./model/Review";
import { Badge } from "./model/Badge";
import { APIError } from "./model/response/error";
import { Database } from "./database";
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

type UserPermissions = {
    canReport: boolean;
    canSubmit: boolean;
    canReview: boolean;
    canScreenshot: boolean;
    canMessage: boolean;
};

@Tags("Users")
@Route("users")
export class UserController extends Controller {
    /**
     * Register New User
     * @summary Register New User
     */
    @SuccessResponse(201, "Created User, with token for auth.")
    @Response<APIError>(400, "Bad Username")
    @Post()
    public async postUser(@Body() requestBody: UserRegistration): Promise<any> {
        const phash = await auth.hashPassword(requestBody.password);
        const user = await datastore.addUser(requestBody.username, phash, requestBody.email);
        if (!user) {
            this.setStatus(400);
            return { error: "User Exists" };
        }
        datastore.addReport(
            {
                type: "user_register",
                targetId: "" + user.id,
                report: "User Registered",
            },
            user.id,
        );

        user.token = auth.getToken(user.name, user.id, user.isAdmin);

        return user;
    }

    /**
     * User List
     * @summary User List
     */
    @SuccessResponse(200, "List of users matching filters")
    @Get()
    public async getUsers(
        @Header("Authorization") authorization?: string,
        @Query() name?: string,
        @Query() following?: boolean,
        @Query() banned?: boolean,
        @Query() page?: number = 0,
        @Query() limit?: number = 50,
        @Query() orderCol?: string,
        @Query() orderDir?: "ASC" | "DESC",
    ): Promise<any[]> {
        const params: GetUsersParms = { page, limit, orderCol, orderDir };
        let user = null;
        try {
            user = extractBearerJWT(authorization);
        } catch (_) {
            console.warn("user provided authorization, but it was invalid");
            //this.setStatus(401);
            //return { error: "unauthenticated users cannot view the user list" };
        }

        if (!user || !user.isAdmin) params.banned = false;
        else params.banned = banned;
        if (following && user && user.sub) params.followerUserId = user.sub;
        if (name) params.name = name;
        //TODO: order by
        const users = await datastore.getUsers(params);

        if (!user || !user.isAdmin) {
            users.forEach((u) => {
                delete u.email;
                delete u.canReport;
                delete u.canSubmit;
                delete u.canReview;
                delete u.canScreenshot;
                delete u.banned;
            });
        }
        return users;
    }

    @SuccessResponse(200, "User's Lists")
    @Get("{uid}/lists")
    public async getUsersLists(
        @Path() uid: number,
        @Query() page?: number = 0,
        @Query() limit?: number = 50,
    ): Promise<any[]> {
        const lists = await datastore.getLists({ uid, page, limit });
        return lists;
    }

    @SuccessResponse(200, "User's Reviews")
    @Get("{id}/reviews")
    public async getUsersReviews(
        @Path() id: number,
        @Query() page?: number = 0,
        @Query() limit?: number = 50,
        //@Query() textReviewsFirst: boolean = false,
        //@Query() includeOwnerReview: boolean = false,
        //@Query() removed: boolean = false,
        @Query() orderCol?: string,
        @Query() orderDir?: "ASC" | "DESC",
    ): Promise<Review[]> {
        const rows = await datastore.getReviews({
            user_id: id,
            removed: false,
            page: page,
            limit: limit,
            orderCol,
            orderDir,
        });
        return rows;
    }

    @SuccessResponse(200, "User's Badges")
    @Get("{id}/badges")
    public async getUsersBadges(@Path() id: number): Promise<Badge[]> {
        const rows = await datastore.getBadges({ user_id: id });
        return rows;
    }

    @Security("bearerAuth", ["admin"])
    @SuccessResponse(200, "User's Permissions")
    @Response<APIError>(401, "Unauthorized")
    @Get("{uid}/permissions")
    public async getUsersPermissions(@Path() uid: number): Promise<UserPermissions> {
        const db = new Database();
        const queryRes: [UserPermissions] = (await db.query(
            "SELECT `can_report`,`can_submit`,`can_review`,`can_screenshot`,`can_message` FROM `User` WHERE `id` = ?",
            [Number(uid)],
        )) as unknown as any;
        await db.close();
        return queryRes[0];
    }

    @Security("bearerAuth", ["admin"])
    @SuccessResponse(200, "User's Permissions")
    @Response<APIError>(401, "Unauthorized")
    @Patch("{uid}/permissions/{pid}")
    public async patchUsersPermissions(
        @Path() uid: number,
        @Path() pid: Permission,
        @Body() requestBody?: EditUserPermissionsParam,
    ): Promise<Permission[]> {
        let revokedUntilStr = null;
        if (requestBody != null) {
            revokedUntilStr = moment(requestBody.revokedUntil).format("YYYY-MM-DD HH:mm:ss");
        }

        await datastore.updatePermission(uid, pid as Permission, revokedUntilStr);
        const ret = await datastore.getPermissions(uid);
        return ret;
    }

    @SuccessResponse(200, "User")
    @Response<void>(404, "Not Found")
    @Get("{id}")
    public async getUser(@Header("Authorization") authorization?: string, @Path() id: number): Promise<any> {
        let authuser = null;
        try {
            authuser = extractBearerJWT(authorization);
        } catch (_) {
            console.warn("user provided authorization, but it was invalid");
        }
        const params = { id, page: 0, limit: 1 } as GetUsersParms;
        if (!authuser || !authuser.isAdmin) params.banned = false;

        const users = await datastore.getUsers(params);
        if (users == null || users.length == 0) return this.setStatus(404);
        const user = users[0];
        if (user && (!authuser || authuser.sub != id)) {
            delete user.email;
            delete user.banned;
        }

        const canSeePerms = !!(authuser && (authuser.sub == id || authuser.isAdmin));
        if (canSeePerms) {
            user.permissions = await datastore.getPermissions(id);
        }
        return user;
    }

    /**
     * Updates a user. If a password is provided, then the old password must also be provided.
     * @summary Modify User (User/Admin Only)
     */
    @Security("bearerAuth", ["user"])
    @SuccessResponse(200, "Updated User")
    @Response<APIError>(401, "Incorrect Old Password")
    @Response<APIError>(403, "Unauthorized attempt to modify another user")
    @Response<void>(404, "Not Found")
    @Patch("{id}")
    public async patchUser(
        @Header("Authorization") authorization: string,
        @Path() id: number,
        @Body() requestBody: any,
    ): Promise<any> {
        // NOTE: auth guard should make the error condition unreachable
        const authuser = extractBearerJWT(authorization);

        const isAdmin = false;
        //if not admin (and if not, uid is not uid in token)
        if (!isAdmin && authuser.sub != id) {
            this.setStatus(403);
            return { error: "unauthorized access to this user" };
        }

        let user = requestBody;
        user.id = id;

        if (requestBody.password) {
            //verify password and abort if incorrect
            const targetUser = await datastore.getUserForLogin({ id: id });
            const pwVerified = await auth.verifyPassword(targetUser.phash2, requestBody.currentPassword);
            if (!pwVerified) {
                this.setStatus(401);
                return { error: "password was missing or doesn't match" };
            }
            const newPassHash = await auth.hashPassword(requestBody.password);
            user.phash2 = newPassHash;
        }

        if (!authuser.isAdmin) {
            delete user.banned;
            delete user.unsuccessfulLogins;
            delete user.lastIp;
            delete user.dateLastLogin;
        }

        const success = await datastore.updateUser(user);
        if (!success) {
            return this.setStatus(404);
        }

        const newUser = await datastore.getUser(id);
        if (newUser == null) return this.setStatus(404);
        else return newUser;
    }

    /**
     * Returns if you are following a user.
     * @summary Check Following (User/Admin Only)
     */
    @Security("bearerAuth", ["user"])
    @SuccessResponse<{ following: boolean }>(200, "Following")
    @Response<APIError>(401, "Not Logged In")
    @Get("follows/{followerId}")
    public async getUserFollow(
        @Header("Authorization") authorization: string,
        @Path() followerId: number,
    ): Promise<{ following: boolean } | APIError> {
        // NOTE: auth guard should make the error condition unreachable
        const user = extractBearerJWT(authorization);

        const db = new Database();
        const queryRes: [{ result: boolean }] = await db.query(
            "SELECT IF(EXISTS(SELECT 1 FROM `UserFollow` WHERE `user_id` = ? AND `user_follow_id` = ?), TRUE, FALSE) AS result",
            [followerId, Number(user.sub)],
        );
        return { following: queryRes[0].result };
    }

    /**
     * Adds a user to your following list. Idempotent.
     * @summary Follow User (User/Admin Only)
     */
    @Security("bearerAuth", ["user"])
    @SuccessResponse(204, "Follower Added")
    @Response<APIError>(401, "Not Logged In")
    @Response<APIError>(403, "Bad Ownership")
    @Response<APIError>(404, "Not Found")
    @Put("{id}/follows/{followerId}")
    public async putUserFollow(
        @Header("Authorization") authorization: string,
        @Path() id: number,
        @Path() followerId: number,
    ): Promise<void> {
        // NOTE: auth guard should make the error condition unreachable
        const user = extractBearerJWT(authorization);

        if (user.sub != id) {
            this.setStatus(403);
            return { error: "cannot modify another user's follower list" };
        }
        const targetUser = await datastore.getUser(+followerId);
        if (!targetUser) return this.setStatus(404);

        await datastore.addFollowToUser(+followerId, user.sub);
        return this.setStatus(204);
    }

    /**
     * Removes a user from your following list. Idempotent.
     * @summary Unfollow User (User/Admin Only)
     */
    @Security("bearerAuth", ["user"])
    @SuccessResponse(204, "Follower Removed")
    @Response<APIError>(401, "Not Logged In")
    @Response<APIError>(403, "Bad Onwership")
    @Response<APIError>(400, "Not Found")
    @Delete("{id}/follows/{followerId}")
    public async deleteUserFollow(
        @Header("Authorization") authorization: string,
        @Path() id: number,
        @Path() followerId: number,
    ): Promise<void> {
        // NOTE: auth guard should make the error condition unreachable
        const user = extractBearerJWT(authorization);

        if (user.sub != id) {
            this.setStatus(403);
            return { error: "cannot modify another user's follower list" };
        }

        const targetUser = await datastore.getUser(+followerId);
        if (!targetUser) return this.setStatus(404);

        await datastore.removeFollowFromUser(+followerId, user.sub);
        return this.setStatus(204);
    }
}
