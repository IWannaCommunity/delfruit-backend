import { type Request, Response } from "express";
import type { StdLogger } from "../../logger";
import type { UserJWT } from "./userjwt";

export interface RequestExt extends Request {
	logger: StdLogger;
	app_user?: UserJWT;
}
