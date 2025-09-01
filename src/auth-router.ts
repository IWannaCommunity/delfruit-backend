import express from "express";
import { Database } from "./database";
import AuthModule from "./lib/auth";
import datastore from "./datastore";
import moment = require("moment");
import crypto from "crypto";
import nodemailer from "nodemailer";
import * as jwt from "jsonwebtoken";
import util from "util";
import axios from "axios";
import Config from "./model/config";
import { Body, Controller, Get, Header, Post, Response, Route, SuccessResponse, Tags } from "tsoa";
let config: Config = require("./config/config.json");

const app = express.Router();
const auth = new AuthModule();
export default app;

export interface AuthResponse {
    /** @isInt @format int64 */
    id: number;
    name: string;
    phash2: string; // TODO: REMOVE THIS!!!!
    /** @isDate @format date */
    dateCreated: string;
    twitchLink?: string;
    youtubeLink?: string;
    nicoLink?: string;
    twitterLink?: string;
    bio?: string;
    isAdmin: boolean;
    email?: string;
    banned: boolean;
    /** @isInt @format int8 */
    selected_badge?: number;
    token: string;
}

interface UserCredentials {
    username: string;
    password: string;
    notARobot: number;
}

interface ResetRequestParams {
    username: string;
    email: string;
}

interface FinalizePassResetParams {
    username: string;
    token: string;
    password: string;
}

interface APIError {
    error: string;
}

@Route("auth")
@Tags("Authentication")
export class AuthController extends Controller {
    /**
     * Login
     * @summary Login
     */
    @SuccessResponse(200, "Logged In")
    @Response<APIError>(401, "Invalid Credentials")
    @Post("login")
    public async postLogin(@Body() requestBody: UserCredentials): Promise<AuthResponse> {
        const username = requestBody.username;
        const password = requestBody.password;

        const database = new Database();
        try {
            // TODO:stop grabbing phash2 or is_admin here
            const users = await database.query("SELECT id,name,phash2,is_admin as isAdmin FROM User WHERE name = ?", [
                username,
            ]);
            if (users.length == 0) {
                this.setStatus(401);
                return { error: "user does not exist" };
            }
            const user = users[0];
            const verified = await auth.verifyPassword(user.phash2, password);

            if (!verified) {
                const u = await datastore.getUser(user.id);
                datastore.updateUser({
                    id: user.id,
                    unsuccessfulLogins: u.unsuccessfulLogins + 1,
                });
                this.setStatus(401);
                return { error: "bad credentials" };
            } else {
                datastore.updateUser({
                    id: user.id,
                    dateLastLogin: moment().format("YYYY-MM-DD HH:mm:ss"),
                    lastIp: this.getHeaders()["x-forwarded-for"],
                    unsuccessfulLogins: 0,
                });
                user.token = auth.getToken(user.name, user.id, user.isAdmin);
                this.setHeader("token", user.token);
                return user;
            }
        } finally {
            database.close();
        }
    }

    /**
     * Request Password Reset
     * @summary Request Password Reset
     */
    @SuccessResponse(204, "Request Accepted")
    @Response<APIError>(400, "Invalid Username")
    @Post("reset-request")
    public async postResetRequest(@Body() requestBody: ResetRequestParams): Promise<void> {
        const token = crypto.randomBytes(126).toString("hex");

        const database = new Database();
        try {
            const results = await database.query("SELECT reset_token_set_time FROM User WHERE name = ? AND email = ?", [
                requestBody.username,
                requestBody.email,
            ]);

            // if no user by name, return OK anyway
            if (results.length === 0) return this.setStatus(204);
            const result = results[0];

            // because we sent a email on each request,
            // this could be used to involentarily spam
            // someone's inbox, which is usually frowned
            // upon by email providers. so we only allow
            // resets every hour.
            const rsts = result.reset_token_set_time;
            if (rsts && moment(rsts).isAfter(moment().subtract(1, "hours"))) {
                console.log(`Attempt to reset password too quickly for ${requestBody.username}!`);
                this.setStatus(425);
                return { error: "too soon to reset, try later" };
            }

            await database.execute(
                `UPDATE User SET reset_token = ?, reset_token_set_time = CURRENT_TIMESTAMP
      WHERE name = ?`,
                [token, requestBody.username],
            );

            let transporter = nodemailer.createTransport(config.smtp);
            // TODO: no html email!!! email was designed for plaintext only!
            let html = `<html>
  <head>
      <style>
          body {
              background-color: #303030;
              color: white;
              font: 400 14px/20px Roboto, "Helvetica Neue", sans-serif;
          }

          .body {
              padding: 1em;
          }

          .header {
              background-color: rgb(63, 81, 181);
              padding: 1em;
          }

          h1 {
              font: 500 20px/32px Roboto, "Helvetica Neue", sans-serif;
          }

          a {
              color: #aaaaff;
          }
      </style>
  </head>
  <body style="margin: 0">
      <div class="header">
          <h1>
              <img alt="delfruit cherry logo" src="data:image/gif;base64,R0lGODlhFQAYALMIABwcHAwMDCEhIQsLC3UAAP9bWwUAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6NTUxOTAxMUFCMEJEMTFFNDk5NkJCOEEwREEzMENFNjEiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6NTUxOTAxMUJCMEJEMTFFNDk5NkJCOEEwREEzMENFNjEiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo1NTE5MDExOEIwQkQxMUU0OTk2QkI4QTBEQTMwQ0U2MSIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo1NTE5MDExOUIwQkQxMUU0OTk2QkI4QTBEQTMwQ0U2MSIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PgH//v38+/r5+Pf29fTz8vHw7+7t7Ovq6ejn5uXk4+Lh4N/e3dzb2tnY19bV1NPS0dDPzs3My8rJyMfGxcTDwsHAv769vLu6ubi3trW0s7KxsK+urayrqqmop6alpKOioaCfnp2cm5qZmJeWlZSTkpGQj46NjIuKiYiHhoWEg4KBgH9+fXx7enl4d3Z1dHNycXBvbm1sa2ppaGdmZWRjYmFgX15dXFtaWVhXVlVUU1JRUE9OTUxLSklIR0ZFRENCQUA/Pj08Ozo5ODc2NTQzMjEwLy4tLCsqKSgnJiUkIyIhIB8eHRwbGhkYFxYVFBMSERAPDg0MCwoJCAcGBQQDAgEAACH5BAkeAAgALAAAAAAVABgAAAR1EMlJKzLYaorz3p0BhgYRfuWhHkXRoSvbumUgWAChzi1WHAQTJaDbzTqtlQghKBp7viRQlFrxXDzlJSa7zrQGrvcL5navMarZa1abd++DOx6f07nC6n1FAEzCeysBHE53fTiBBBsDOW8mSxoAGIUeHxIkkBQRACH5BAUeAAgALAAAAAAVABgAAARyEMlJq71Ymm0u/xpIbcRhmsS3VUB5FnDBXYF7xDEZVIJ945vCgSCYGHw4WVCY0pxMwKXw0Dk+fzkcanPFJmEnbvcLDhu6Xq0ZDY11xew4Kc5unulvjQ/flLTwKAAVA3tdBDsWf3WCGHNPKR0ZISqSlRcRADs=" />
              <span class="title">Delicious Fruit 2.0 - Password Reset</span>
          </h1>
      </div>
      <div class="body">
          Greetings from Delicious Fruit!
          <br><br>
          A password reset request was made on your behalf. If this wasn't you, you can safely ignore this message.
          <br><br>
          To reset your password, click here: <a href='http://delicious-fruit.com/password-reset?name=%s&token=%s'>Reset Password</a>
          <br><br>
          This link is valid for 2 hours since making the request.
          <br><br>
          -The staff at Delicious-Fruit ❤️
      </div>
  </body>
</html>`;
            html = util.format(html, requestBody.username, token);

            //sendmail is being called non-synchronously here (without await) because it can take a second
            //we're not telling the client anything different whether it succeeds or fails
            //so just send the 204 at this point
            transporter
                .sendMail({
                    from: "webmaster@delicious-fruit.com",
                    to: requestBody.email,
                    subject: `Delicious-Fruit Password Reset`,
                    html,
                    text: `Greetings from Delicious Fruit!\n
A password reset request was made on your behalf. If this wasn't you, you can safely ignore this message.\n
To reset your password, visit this link: http://delicious-fruit.com/password_reset.php?name=${requestBody.username}&token=${token} \n
This link is valid for 2 hours since making the request.\n
-The staff at Delicious-Fruit ❤️`,
                })
                .then((mailResult) => {
                    console.log(mailResult);
                })
                .catch((err) => {
                    console.log("Error sending mail!");
                    console.log(err);
                });
            return this.setStatus(204);
        } finally {
            database.close();
        }
    }

    /**
     * Should be called with the token the user received in their reset email. Generates a token after successful completion.
     *     @summary Finalize Password Reset
     * */
    @SuccessResponse(200, "Password Reset")
    @Response<APIError>(401, "Bad Username/Token Pair")
    @Response<APIError>(422, "Unusable Token")
    @Post("reset")
    public async postFinalizePassReset(@Body() requestBody?: FinalizePassResetParams): Promise<AuthResponse> {
        const database = new Database();
        try {
            const results = await database.query(
                `
    SELECT id,reset_token_set_time,is_admin,reset_token_set_time FROM User 
    WHERE name = ? AND reset_token = ?`,
                [requestBody.username, requestBody.token],
            );
            if (results.length == 0) {
                this.setStatus(401);
                return { error: "no matching reset request with provided name and token" };
            }
            if (results.length > 1) {
                console.log(
                    `retrieved multiple users! username:[${requestBody.username}] token:[${requestBody.token}]`,
                );
                this.setStatus(422);
                return { error: "token is unusable, generate a new one" };
            }

            if (
                results[0].reset_token_set_time &&
                moment(results[0].reset_token_set_time).isBefore(moment().subtract(2, "hours"))
            ) {
                console.log(`Attempted to use an old reset token for ${requestBody.username}`);
                this.setStatus(422);
                return { error: "token was already used" };
            }

            const phash = await auth.hashPassword(requestBody.password);
            await database.execute(
                `UPDATE User SET 
      phash2 = ? ,
      phash = '' ,
      salt = '' ,
      reset_token = null,
      reset_token_set_time = null,
      ali_token = null,
      ali_date_set = null
    WHERE id = ? `,
                [phash, results[0].id],
            );

            //get user for login
            // TODO: don't grab phash2 or isAdmin
            const users = await database.query("SELECT id,name,phash2,is_admin as isAdmin FROM User WHERE name = ?", [
                requestBody.username,
            ]);
            // QUEST: i think the predicate below has a 0% chance of ever happening, right?
            if (users.length == 0) {
                this.setStatus(401);
                return { error: "invalid credentials" };
            }
            const user = users[0];
            user.token = auth.getToken(user.name, user.id, user.isAdmin);

            datastore.addReport(
                {
                    type: "user_password_change",
                    targetId: "" + user.id,
                    report: "User password changed",
                },
                user.id,
            );

            this.setHeader("token", user.token);
            return user;
        } finally {
            database.close();
        }
    }

    /**
     * Allows a user with a valid token to request a fresh token with a new expiration date. This should be invoked whenever the 'useExp' timestamp in the token payload has been exceeded.
     * @summary Refresh Token
     * */
    @SuccessResponse(200, "Latest user data with a fresh token")
    @Response(401, "Expired or Invalid Token")
    @Post("refresh")
    public async postRefresh(@Header("Authorization") authorization: string): Promise<AuthResponse> {
        let token = null;
        try {
            token = extractBearerJWT(authorization);
        } catch (e) {
            this.setStatus(401);
            return { error: "expired or invalid token" };
        }
        const user = await datastore.getUser(token.sub);
        if (!user) {
            this.setStatus(401);
            return { error: "specified user with this token does not exist" };
        }
        user.token = auth.getToken(user.name, user.id, user.isAdmin);
        this.setHeader("token", user.token);
        return user;
    }
}

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

export async function recaptchaVerify(action: string, token: string, remoteIp?: string): Promise<boolean> {
    if (!config.recaptcha_secret) {
        //console.log('recaptcha secret missing, skipping validation');
        return true;
    }
    const request: any = {
        secret: config.recaptcha_secret,
        response: token,
    };
    if (remoteIp) request.remoteip = remoteIp;
    try {
        const rsp = await axios.post("https://www.google.com/recaptcha/api/siteverify", request);
        if (!rsp.data.success) {
            console.log("reCaptcha: Invalid token!");
            console.log(rsp.data);
            return false;
        }
        if (rsp.data.action != action) {
            console.log("reCaptcha: Action doesn't match expected action! expected: " + action);
            console.log(rsp.data);
            return false;
        }
        if (rsp.data.score < config.recaptcha_threshold) {
            console.log("reCaptcha: score under threshold!");
            console.log(rsp.data);
            return false;
        }
        return true;
    } catch (err) {
        console.log("recaptcha verify error! allowing request");
        console.log(err);
        return true;
    }
}
