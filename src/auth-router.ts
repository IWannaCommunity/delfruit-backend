import express from 'express';
import { Database } from './database';
import AuthModule from './lib/auth';
import datastore from './datastore';
import moment = require('moment');
import crypto from 'crypto';
import handle from './lib/express-async-catch';
import { userCheck } from './lib/auth-check';
import nodemailer from 'nodemailer';
import util from 'util';
import axios from 'axios';
import Config from './model/config';
let config: Config = require('./config/config.json');

const app = express.Router();
const auth = new AuthModule();
export default app;

/**
 * @swagger
 * 
 * /auth/login:
 *   post:
 *     summary: Login
 *     description: Login
 *     headers:
 *      token:
 *        schema:
 *          type: string
 *        description: User's token. Send in the Authorization header 
 *                     as 'Bearer {token}' to execute requests as this user.
 *     tags: 
 *       - Authentication
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: username
 *         in: formData
 *         required: true
 *         type: string
 *       - name: password
 *         in: formData
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: logged in
 *         content:
 *              application/json:
 *                      schema:
 *                              $ref: '#/components/schemas/UserLogin'
 *       401:
 *         description: username/password invalid
 *         content:
 *              application/json:
 *                      schema:
 *                              $ref: '#/components/schemas/Error'
 *
 * components:
 *      schemas:
 *              UserLogin:
 *                      type: object
 *                      properties:
 *                              id:
 *                                      type: integer
 *                                      format: int64
 *                              name:
 *                                      type: string
 *                              dateCreated:
 *                                      type: string
 *                                      format: date
 *                              twitchLink:
 *                                      type: string
 *                              youtubeLink:
 *                                      type: string
 *                              nicoLink:
 *                                      type: string
 *                              twitterLink:
 *                                      type: string
 *                                      format: url
 *                              bio:
 *                                      type: string
 *                              isAdmin:
 *                                      type: boolean
 *                              email:
 *                                      type: string
 *                                      format: email
 *                              banned:
 *                                      type: boolean
 *                              selected_badge:
 *                                      type: integer
 *                      required:
 *                              - id
 *                              - name
 *                              - dateCreated
 *                              - isAdmin
 *                              - banned
 */
app.route('/login').post(handle(async (req, res, next) => {
    const username = req.body.username;
    const password = req.body.password;

    const rcptoken = req.body.rcptoken;
    const verified = await recaptchaVerify('login', rcptoken, req.ip);
    if (!verified) {
        console.log('recaptcha verify failed!')
        return res.sendStatus(403);
    }

    const database = new Database();
    try {
        const users = await database.query('SELECT id,name,phash2,is_admin as isAdmin FROM User WHERE name = ?', [username]);
        if (users.length == 0) {
            res.status(401).send({ error: 'Invalid Credentials' });
        }
        const user = users[0];
        const verified = await auth.verifyPassword(user.phash2, password)

        if (!verified) {
            const u = await datastore.getUser(user.id);
            datastore.updateUser({
                id: user.id,
                unsuccessfulLogins: u.unsuccessfulLogins + 1
            });
            return res.status(401).send({ error: 'Invalid Credentials' });
        } else {
            datastore.updateUser({
                id: user.id,
                dateLastLogin: moment().format('YYYY-MM-DD HH:mm:ss'),
                lastIp: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                unsuccessfulLogins: 0
            });
            user.token = auth.getToken(user.name, user.id, user.isAdmin);
            res.setHeader('token', user.token);
            return res.send(user);
        }
    } finally {
        database.close();
    }
}));

/**
 * @swagger
 * 
 * /auth/reset-request:
 *   post:
 *     summary: Request Password Reset
 *     description: Request Password Reset
 *     tags: 
 *       - Authentication
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: username
 *         in: formData
 *         required: true
 *         type: string
 *     responses:
 *       204:
 *         description: request accepted
 *       400:
 *         description: invalid username or username missing
 *         content:
 *              application/json:
 *                      schema:
 *                              $ref: '#/components/schemas/Error'
 */
app.route('/request-reset').post(handle(async (req, res, next) => {
    const username = req.body.username;
    if (!username) return res.status(400).send({ error: "missing username in request body" });
    const email = req.body.email;
    if (!email) return res.status(400).send({ error: "missing email in request body" });

    const rcptoken = req.body.rcptoken;
    const verified = await recaptchaVerify('requestPwReset', rcptoken, req.ip);
    if (!verified) {
        console.log('recaptcha verify failed!')
        return res.sendStatus(403);
    }

    const token = crypto.randomBytes(126).toString('hex');

    const database = new Database();
    try {
        const results = await database.query('SELECT reset_token_set_time FROM User WHERE name = ? AND email = ?', [username, email])

        //204 if no user by name
        if (results.length === 0) return res.sendStatus(204);
        const result = results[0]

        //204 if already requested reset within the hour
        const rsts = result.reset_token_set_time;
        if (rsts && moment(rsts).isAfter(moment().subtract(1, 'hours'))) {
            console.log(`Attempt to reset password too quickly for ${username}!`);
            return res.sendStatus(204);
        }

        await database.execute(
            `UPDATE User SET reset_token = ?, reset_token_set_time = CURRENT_TIMESTAMP
      WHERE name = ?`, [token, username]);

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
        html = util.format(html, username, token);

        //sendmail is being called non-synchronously here (without await) because it can take a second
        //we're not telling the client anything different whether it succeeds or fails
        //so just send the 204 at this point
        transporter.sendMail({
            from: "webmaster@delicious-fruit.com",
            to: email,
            subject: `Delicious-Fruit Password Reset`,
            html,
            text: `Greetings from Delicious Fruit!\n
A password reset request was made on your behalf. If this wasn't you, you can safely ignore this message.\n
To reset your password, visit this link: http://delicious-fruit.com/password_reset.php?name=${username}&token=${token} \n
This link is valid for 2 hours since making the request.\n
-The staff at Delicious-Fruit ❤️`
        }).then(mailResult => {
            console.log(mailResult);
        }).catch(err => {
            console.log("Error sending mail!");
            console.log(err);
        });
        return res.sendStatus(204);

    } finally {
        database.close();
    }
}));

/**
 * @swagger
 * 
 * /auth/reset:
 *   post:
 *     summary: Submit Password Reset
 *     description: Should be called with the token the user received in their reset email. 
 *                  Generates a token after successful completion.
 *     headers:
 *      token:
 *        schema:
 *          type: string
 *        description: User's token. Send in the Authorization header 
 *                     as 'Bearer {token}' to execute requests as this user.
 *     tags: 
 *       - Authentication
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: username
 *         in: formData
 *         required: true
 *         type: string
 *       - name: token
 *         in: formData
 *         required: true
 *         type: string
 *       - name: password
 *         in: formData
 *         required: true
 *         type: string
 *         description: the new password
 *     responses:
 *       204:
 *         description: password reset
 *         content:
 *              application/json:
 *                      schema:
 *                              $ref: '#/components/schemas/PassResetResp'
 *       400:
 *         description: invalid username/token
 *         content:
 *              application/json:
 *                      schema:
 *                              $ref: '#/components/schemas/Error'
 * components:
 *      schemas:
 *              PassResetResp:
 *                      type: object
 *                      properties:
 *                              id:
 *                                      type: integer
 *                                      format: int64
 *                              name:
 *                                      type: string
 *                              token:
 *                                      type: string
  *                      required:
 *                              - id
 *                              - name
 *                              - token

 */
app.route('/reset').post(handle(async (req, res, next) => {
    const username = req.body.username;
    if (!username) {
        return res.status(401).send({ error: "no username in request body" });
    }
    const token = req.body.token;
    if (!token) {
        return res.status(401).send({ error: "no token in request body" });
    }

    const rcptoken = req.body.rcptoken;
    const verified = await recaptchaVerify('resetPW', rcptoken, req.ip);
    if (!verified) {
        console.log('recaptcha verify failed!')
        return res.sendStatus(403);
    }

    const database = new Database();
    try {
        const results = await database.query(`
    SELECT id,reset_token_set_time,is_admin,reset_token_set_time FROM User 
    WHERE name = ? AND reset_token = ?`, [username, token])
        if (results.length == 0) {
            console.log('no db match!')
            return res.sendStatus(401);
        }
        if (results.length > 1) {
            console.log(`retrieved multiple users! username:[${username}] token:[${token}]`);
            return res.sendStatus(401);
        }

        if (results[0].reset_token_set_time
            && moment(results[0].reset_token_set_time).isBefore(moment().subtract(2, 'hours'))) {
            console.log(`Attempted to use an old reset token for ${username}`);
            return res.sendStatus(401);
        }

        const phash = await auth.hashPassword(req.body.password);
        await database.execute(
            `UPDATE User SET 
      phash2 = ? ,
      phash = '' ,
      salt = '' ,
      reset_token = null,
      reset_token_set_time = null,
      ali_token = null,
      ali_date_set = null
    WHERE id = ? `, [phash, results[0].id]);

        //get user for login
        const users = await database.query('SELECT id,name,phash2,is_admin as isAdmin FROM User WHERE name = ?', [username]);
        if (users.length == 0) {
            res.status(401).send({ error: 'Invalid Credentials' });
        }
        const user = users[0];
        user.token = auth.getToken(user.name, user.id, user.isAdmin);

        datastore.addReport({
            type: "user_password_change",
            targetId: "" + user.id,
            report: "User password changed"
        }, user.id);


        res.setHeader('token', user.token);
        return res.send(user);
    } finally {
        database.close();
    }
}));

/**
 * @swagger
 * 
 * /auth/refresh:
 *   post:
 *     summary: Refresh Token
 *     description: Allows a user with a valid token to request a fresh token
 *                  with a new expiration date. This should be invoked whenever
 *                  the 'useExp' timestamp in the token payload has been
 *                  exceeded.
 *     headers:
 *      token:
 *        schema:
 *          type: string
 *        description: User's token. Send in the Authorization header 
 *                     as 'Bearer {token}' to execute requests as this user.
 *     tags: 
 *       - Authentication
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Latest user data with fresh token
 *         content:
 *              application/json:
 *                      schema:
 *                              $ref: '#/components/schemas/UserWithTokenResp'
 *       401:
 *         description: Unauthorized (Not logged in or token expired)
 * components:
 *      schemas:
 *              UserWithTokenResp:
 *                      type: object
 *                      properties:
 *                              id:
 *                                      type: integer
 *                                      format: int64
 *                              name:
 *                                      type: string
 *                              dateCreated:
 *                                      type: string
 *                                      format: date
 *                              twitchLink:
 *                                      type: string
 *                              youtubeLink:
 *                                      type: string
 *                              nicoLink:
 *                                      type: string
 *                              twitterLink:
 *                                      type: string
 *                                      format: url
 *                              bio:
 *                                      type: string
 *                              isAdmin:
 *                                      type: boolean
 *                              email:
 *                                      type: string
 *                                      format: email
 *                              banned:
 *                                      type: boolean
 *                              selected_badge:
 *                                      type: integer
 *                              token:
 *                                      type: string
 *                      required:
 *                              - id
 *                              - name
 *                              - dateCreated
 *                              - isAdmin
 *                              - banned
 *                              - token

 */
app.route('/refresh').post(userCheck(), handle(async (req, res, next) => {
    const user = await datastore.getUser(req.user.sub);
    if (!user) return res.sendStatus(401);
    user.token = auth.getToken(user.name, user.id, user.isAdmin);
    res.setHeader('token', user.token);
    return res.send(user);
}));

export async function recaptchaVerify(action: string, token: string, remoteIp?: string): Promise<boolean> {
    if (!config.recaptcha_secret) {
        //console.log('recaptcha secret missing, skipping validation');
        return true;
    }
    const request: any = {
        'secret': config.recaptcha_secret,
        'response': token,
    };
    if (remoteIp) request.remoteip = remoteIp;
    try {
        const rsp = await axios.post("https://www.google.com/recaptcha/api/siteverify", request);
        if (!rsp.data.success) {
            console.log("reCaptcha: Invalid token!")
            console.log(rsp.data)
            return false;
        }
        if (rsp.data.action != action) {
            console.log("reCaptcha: Action doesn't match expected action! expected: " + action)
            console.log(rsp.data)
            return false;
        }
        if (rsp.data.score < config.recaptcha_threshold) {
            console.log("reCaptcha: score under threshold!")
            console.log(rsp.data)
            return false;
        }
        return true;
    } catch (err) {
        console.log('recaptcha verify error! allowing request')
        console.log(err);
        return true;
    }
}
