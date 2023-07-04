import { userCheck, adminCheck, AuthnCheck } from "./auth-check";
import * as jwt from "jsonwebtoken";
import { Request, Response } from "express";

let config: Config = require('../config/config.json');

export function expressAuthentication(req: Request, securityName: string, scopes?: string[]): Promise<object | Response> {
    // only supports bearerAuth security scheme
    if ((securityName !== "bearerAuth") || (!scopes)) {
        return Promise.reject();
    }

    // we also need the response object to properly return errors
    if (!req.res) {
        return Promise.reject({});
    }
    const resp = req.res;

    // HACK: unfortunately, we need to manually split the header in two to get the token
    if (!req.headers["authorization"] || !req.headers["authorization"].includes("Bearer ")) {
        return Promise.reject(
            resp.status(401).contentType("application/json").send({ error: "bearer auth malformed or missing in header" })
        );
    }
    const unverified_token = req.headers["authorization"].split(" ")[1];

    let token = null;
    try {
        token = jwt.verify(unverified_token, config.app_jwt_secret);
    } catch (e) {
        // TODO: log e, do NOT return it to the user
        return Promise.reject(
            resp.status(401).contentType("application/json").send({ error: "invalid token" })
        );
    }

    if (token.isAdmin === false) {
        if (userCheck(token) === AuthnCheck.Authorized) {
            return Promise.resolve({});
        } else {
            return Promise.reject(
                resp.status(403).contentType("application/json").send({ error: "not signed in" })
            );
        }
    } else {
        if (adminCheck(token) === AuthnCheck.Authorized) {
            return Promise.resolve({});
        } else {
            return Promise.reject(
                resp.status(403).contentType("application/json").send({ error: "endpoint requires admin permission" })
            );
        }
    }

    return Promise.reject({ error: "" });
}
