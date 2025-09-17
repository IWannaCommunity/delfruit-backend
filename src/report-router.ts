import express from "express";
import datastore from "./datastore";
import { Report } from "./model/Report";
import handle from "./lib/express-async-catch";
import { adminCheck, userCheck } from "./lib/auth-check";
import {
    Body,
    Controller,
    Get,
    Header,
    Patch,
    Path,
    Post,
    Queries,
    Query,
    Response,
    Route,
    Security,
    SuccessResponse,
    Tags,
} from "tsoa";
import { GetReportParams } from "./model/GetReportParams";

const app = express.Router();
export default app;

import Config from "./model/config";
let config: Config = require("./config/config.json");

import * as jwt from "jsonwebtoken";
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

@Tags("Reports")
@Route("reports")
export class ReportController extends Controller {
    /**
     * Report List (Admin Only)
     * @summary Repost List (Admin Only)
     */
    @Security("bearerAuth", ["admin"])
    @SuccessResponse(200, "List of Reports within matching filters.")
    @Get()
    public async getReports(@Queries() requestQuery?: GetReportParams): Promise<Report[]> {
        const n = await datastore.getReports({
            type: requestQuery.type,
            answered: requestQuery.answered,
            id: requestQuery.id ? +requestQuery.id : undefined,
            page: +requestQuery.page || 0,
            limit: +requestQuery.limit || 50,
        });

        return n;
    }

    /**
     * Get Report (Admin Only)
     * @summary Get Report (Admin Only)
     */
    @Security("bearerAuth", ["admin"])
    @SuccessResponse(200, "Get Report")
    @Response<void>(404, "Not Found")
    @Get("{id}")
    public async getReport(@Path() id: number): Promise<Report> {
        const report = await datastore.getReport(+id);
        if (!report) return this.setStatus(404);
        return report;
    }

    /**
     * Allows admins to update the report, such as marking it as resolved.
     * @summary Update Report (Admin Only)
     */
    @Security("bearerAuth", ["admin"])
    @SuccessResponse(200, "Updated Report")
    @Response<void>(404, "Not Found")
    @Patch("{id}")
    public async patchReport(@Path() id: number, @Body() requestBody: Report): Promise<Report> {
        const ogReport = await datastore.getReport(id);
        if (!ogReport) return this.setStatus(404);

        const report = {
            id: +id,
            answeredById: requestBody.answeredById,
            dateAnswered: requestBody.dateAnswered,
        } as Report;

        const success = await datastore.updateReport(report);
        if (success) return await datastore.getReport(id);
        else throw "failed to update report"; // QUEST: can throwing return a parsable error?
    }

    /**
     * Allows a user to submit a report.
     * @summary Submit Report (User/Admin Only)
     */
    @Security("bearerAuth", ["user"])
    @SuccessResponse(201, "Report Submitted")
    @Response<void>(400, "Invalid Type")
    @Post()
    public async postReport(
        @Header("Authorization") authorization: string,
        @Body() requestBody: Report,
    ): Promise<Report> {
        // NOTE: auth guard should make the error condition unreachable
        const user = extractBearerJWT(authorization);

        const uid = user.sub;

        const report = requestBody;
        delete report.answeredById;
        delete report.dateAnswered;

        return await datastore.addReport(report, uid);
    }
}
