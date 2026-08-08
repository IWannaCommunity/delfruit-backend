import express from "express";
import {
	Body,
	Controller,
	Get,
	Post,
	Queries,
	Query,
	Route,
	Security,
	SuccessResponse,
	Tags,
} from "tsoa";
import datastore from "../datastore";
import { userCheck } from "../lib/auth-check";
import handle from "../lib/express-async-catch";
import type { getTagsParms } from "../model/getTagsParms";

const app = express.Router();
export default app;

@Tags("Tags")
@Route("tags")
export class TagController extends Controller {
	@Security("bearerAuth", ["user"])
    @SuccessResponse(200, "Created Tag")
    @Post()
    public async postTag(@Body() requestBody: any): Promise<any> {
        const tag = await datastore.createTag(requestBody.name);
        return tag;
    }

	@SuccessResponse(200, "List of Tags")
    @Get()
    public async getTags(@Queries() requestQuery: getTagsParms): Promise<any[]> {
        const tagId = +requestQuery.tagId || undefined
        const userId = +requestQuery.userId || undefined
        const q = requestQuery.q || undefined
        const name = requestQuery.name || undefined

        const rows = await datastore.getTags(tagId, q, name);
        return rows;
    }

	@Security("bearerAuth", ["user"])
	@SuccessResponse(200, "List of All Tags")
	@Get("/all")
	public async getAllTags(): Promise<any[]> {
		return await datastore.getAllTags();
	}
}
