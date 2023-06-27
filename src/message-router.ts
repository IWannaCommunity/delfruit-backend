import express from 'express';
import { Database } from './database';
import InsertList from './lib/insert-list';
import WhereList from './lib/where-list';
import { Message } from './model/Message';
import { MessageQueryParams } from './model/MessageQueryParams';
import handle from './lib/express-async-catch';
import { userCheck } from './lib/auth-check';
import { Body, Controller, Get, Header, Path, Post, Route, Security, SuccessResponse, Tags } from 'tsoa';

const app = express.Router();
export default app;

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

@Tags("Messages")
@Route("message")
export class MessageController extends Controller {
    @Security("bearerAuth", ["user"])
    @SuccessResponse(200, "List of Messages")
    @Get("/inbox")
    public async getMessagesFromInbox(@Header("Authorization") authorization: string): Promise<Message[]> {
        // NOTE: auth guard should make the error condition unreachable
        const user = extractBearerJWT(authorization);

        let parms = {} as MessageQueryParams;
        parms.userToId = user.sub; //force to for inbox

        const whereList = new WhereList();
        whereList.add("user_to_id", parms.userToId);

        const database = new Database();
        try {
            const messages = await database.query(`
      SELECT *, thread_id as threadId
      FROM Message 
      ${whereList.getClause()}`, whereList.getParams());
            return messages;
        } finally {
            database.close();
        }
    }

    @Security("bearerAuth", ["user"])
    @SuccessResponse(200, "List of Messages from thread")
    @Get("thread/{id}")
    public async getMessagesFromThread(@Header("Authorization") authorization: string, @Path() id: number): Promise<Message[]> {
        // NOTE: auth guard should make the error condition unreachable
        const user = extractBearerJWT(authorization);

        let parms = {} as MessageQueryParams;
        parms.threadId = +id;

        const whereList = new WhereList();
        whereList.add("thread_id", parms.threadId);
        //don't allow viewing a thread if you're not one of the participants
        whereList.addPhrase("user_to_id = ? OR user_from_id = ?", user.sub, user.sub);

        const database = new Database();
        try {
            const messages = await database.query(`
      SELECT *
      FROM Message 
      ${whereList.getClause()}`, whereList.getParams());
            return messages;
        } finally {
            database.close();
        }

    }

    @Security("bearerAuth", ["user"])
    @SuccessResponse(201, "Sent Message")
    @Post()
    public async postMessage(@Header("Authorization") authorization: string, @Body() requestBody: Message): Promise<void> {
        // NOTE: auth guard should make the error condition unreachable
        const user = extractBearerJWT(authorization);

        const insertList = new InsertList();
        insertList.add("user_from_id", user.sub);
        insertList.add("user_to_id", requestBody.userToId);
        insertList.add("subject", requestBody.subject);
        insertList.add("body", requestBody.body);
        insertList.add("reply_to_id", requestBody.replyToId);

        const database = new Database();
        try {
            let result = await database.execute(`
      INSERT INTO Message ${insertList.getClause()}`, insertList.getParams());
            if (!requestBody.replyToId) { //new thread
                result = await database.execute(`
        UPDATE Message SET thread_id = id WHERE id = ?`, result.insertId);
                if (result.affectedRows != 1) throw 'Wonky database error!';
            } else {
                let replyTo = await database.query(`
        SELECT thread_id FROM Message WHERE id = ?`, result.replyToId);
                if (replyTo.length != 1) {

                }
                result = await database.execute(`
        UPDATE Message SET thread_id = ? WHERE id = ?`, [replyTo[0].thread_id, result.insertId]);
                if (result.affectedRows != 1) throw 'Wonky database error!';
            }

            this.setStatus(201);
            return;
        } finally {
            database.close();
        }

    }
}
