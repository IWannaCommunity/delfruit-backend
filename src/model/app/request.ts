import { type Request, Response } from "express";
import type { StdLogger } from "../../logger";
import type Config from "../../repository/config";
import type { UserJWT } from "./userjwt";

export interface RequestExt extends Request {
	logger: StdLogger;
	app_user?: UserJWT;
	appConfig: Config;
}
