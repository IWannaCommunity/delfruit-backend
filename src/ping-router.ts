import express from 'express';
import handle from './lib/express-async-catch';
import { Controller, Get, Response, Route, SuccessResponse, Tags } from 'tsoa';

const app = express.Router();
export default app;

@Route("ping")
export class PingController extends Controller {
    @SuccessResponse(200, "Pong")
    @Get()
    public async getPing(): Promise<string> {
        return "pong";
    }

    @Response(400, "Oops!")
    @Get("error")
    public async getError(): Promise<string> {
        return "oops";
    }

    @Response(400, "Oops!")
    @Get("error2")
    public async getError2(): Promise<string> {
        throw "oops";
    }

}
