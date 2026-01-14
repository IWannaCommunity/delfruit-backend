import { Request, type Response } from "express";
import * as jwt from "jsonwebtoken";
import type { RequestExt } from "../model/app/request";
import { AuthnCheck, adminCheck, userCheck } from "./auth-check";

const config: Config = require("../config/config.json");

function extractBearerJWT(header_token: string): string | object {
	try {
		return jwt.verify(header_token, config.app_jwt_secret);
	} catch (e) {
		throw new Error(`invalid token: ${e}`);
	}
}

export function expressAuthentication(
	req: RequestExt,
	securityName: string,
	scopes?: string[],
): Promise<object | Response> {
	// only supports bearerAuth security scheme
	if (securityName !== "bearerAuth" || !scopes) {
		return Promise.reject();
	}

	// we also need the response object to properly return errors
	if (!req.res) {
		return Promise.reject({});
	}
	const resp = req.res;

	if (!req.headers.authorization.includes("Bearer ")) {
		return Promise.reject(
			resp
				.status(401)
				.contentType("application/json")
				.send({ error: "missing bearer prefix" }),
		);
	}

	// HACK: unfortunately, we need to manually split the header in two to get the token
	if (!req.headers["authorization"]) {
		return Promise.reject(
			resp
				.status(401)
				.contentType("application/json")
				.send({ error: "bearer auth malformed or missing in header" }),
		);
	}
	const unverified_token = req.headers["authorization"].split(" ")[1];

	let token = null;
	try {
		token = extractBearerJWT(unverified_token);
	} catch (e) {
		// TODO: log e, do NOT return it to the user
		return Promise.reject(
			resp
				.status(401)
				.contentType("application/json")
				.send({ error: "invalid token" }),
		);
	}

	// HACK: actually check scopes instead of whatever the fuck is happen below here
	if (scopes && scopes[0] === "user") {
		if (userCheck(token) === AuthnCheck.Authorized) {
			req.app_user = token;
			return Promise.resolve({});
		}
	}

	if (token.isAdmin === false) {
		if (userCheck(token) === AuthnCheck.Authorized) {
			req.app_user = token;
			return Promise.resolve({});
		} else {
			return Promise.reject(
				resp
					.status(403)
					.contentType("application/json")
					.send({ error: "not signed in" }),
			);
		}
	} else {
		if (adminCheck(token) === AuthnCheck.Authorized) {
			req.app_user = token;
			return Promise.resolve({});
		} else {
			return Promise.reject(
				resp
					.status(403)
					.contentType("application/json")
					.send({ error: "endpoint requires admin permission" }),
			);
		}
	}

	return Promise.reject({ error: "" });
}
