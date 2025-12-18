import express from "express";
import {
	Body,
	Controller,
	Delete,
	Get,
	Header,
	Patch,
	Path,
	Queries,
	Query,
	Response,
	Route,
	Security,
	SuccessResponse,
	Tags,
} from "tsoa";
import datastore from "../datastore";
import { adminCheck } from "../lib/auth-check";
import handle from "../lib/express-async-catch";
import type { GetScreenshotParms } from "../model/GetScreenshotParms";
import { Permission } from "../model/Permission";
import type { Screenshot } from "../model/Screenshot";

const app = express.Router();
export default app;

import type Config from "../model/config";
const config: Config = require("../config/config.json");

import * as jwt from "jsonwebtoken";
import type { APIError } from "../model/response/error";
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

@Tags("Screenshots")
@Route("screenshots")
export class ScreenshotController extends Controller {
	/**
	 * Get List of Screenshots
	 * @summary Get List of Screenshots
	 */
	@SuccessResponse(200, "List of matching Screenshots")
	@Get()
	public async getScreenshots(
		@Header("Authorization") authorization?: string,
		@Queries() requestQuery?: GetScreenshotParms,
	): Promise<Screenshot[]> {
		let isAdmin = false;
		try {
			const user = extractBearerJWT(authorization);
			isAdmin = user.isAdmin;
		} catch (_) {
			console.warn("user provided authorization, but it was invalid");
		}

		requestQuery.page = +requestQuery.page ?? 0;
		requestQuery.limit = Math.min(Math.max(+requestQuery.limit ?? 50, 1), 50);

		if (!isAdmin) requestQuery.removed = false; // TODO: allow toggle
		const rows = await datastore.getScreenshots(requestQuery);

		return rows;
	}

	/**
	 * Get Screenshot
	 * @summary Get Screenshot
	 */
	@SuccessResponse(200, "Screenshot Details")
	@Response<void>(404, "Not Found")
	@Get("{id}")
	public async getScreenshot(
		@Header("Authorization") authorization?: string,
		@Path() id: number,
	): Promise<Screenshot> {
		let isAdmin = false;
		try {
			const user = extractBearerJWT(authorization);
			isAdmin = user.isAdmin;
		} catch (_) {
			console.warn("user provided authorization, but it was invalid");
		}

		const screenshot = await datastore.getScreenshot(id);
		if (!screenshot || (!isAdmin && screenshot.removed)) {
			return this.setStatus(404);
		}
		return screenshot;
	}

	@Security("bearerAuth", ["admin"])
	@SuccessResponse(204, "Successfully Deleted")
	@Response<APIError>(200, "Already Deleted")
	@Response<void>(404, "Not Found")
	@Delete("{id}")
	public async deleteScreenshot(
		@Header("authorization") authorization: string,
		@Path() id: number,
	): Promise<void> {
		// NOTE: auth guard should make the error condition unreachable
		const user = extractBearerJWT(authorization);

		let screenshot = await datastore.getScreenshot(id);

		if (!screenshot) return this.setStatus(404);
		screenshot = screenshot!;

		if (screenshot.removed) return { error: "Screenshot is already deleted" };

		const ssPatch: any = {
			id: +id,
			removed: true,
		};
		await datastore.updateScreenshot(ssPatch, user.isAdmin);

		datastore.addReport(
			{
				type: "screenshot_remove",
				targetId: "" + ssPatch.id,
				report: "Screenshot Removed",
			},
			user.sub,
		);

		this.setStatus(204);
	}

	@Security("bearerAuth", ["admin"])
	@SuccessResponse(200, "Successfully Updated")
	@Response<void>(404, "Not Found")
	@Patch("{id}")
	public async patchScreenshot(
		@Header("Authorization") authorization: string,
		@Path() id: number,
		@Body() requestBody: Screenshot,
	): Promise<Screenshot> {
		// NOTE: auth guard should make the error condition unreachable
		const user = extractBearerJWT(authorization);

		const game = requestBody;
		game.id = id;

		const gameFound = await datastore.updateScreenshot(game, user.isAdmin);
		if (!gameFound) return this.setStatus(404);

		const newGame = await datastore.getScreenshot(id);
		if (newGame == null) return this.setStatus(404);

		const userScreenshots = await datastore.getScreenshots({
			addedById: newGame!.addedById!,
			approved: true,
			page: 0,
			limit: 10,
		});
		if (userScreenshots.length >= 10) {
			console.log("grant permission");
			await datastore.grantPermission(
				newGame!.addedById!,
				Permission.AUTO_APPROVE_SCREENSHOT,
			);
		}

		return newGame;
	}
}
