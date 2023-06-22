import { RequestHandler } from "express";
import AuthModule from "./auth";

export function refreshToken(): RequestHandler {
    return (req, res, next) => {
        //only refresh if there's a user in context
        if (req.user && req.user.sub) {
            const newToken = new AuthModule().getToken(
                req.user.username,
                req.user.sub,
                req.user.isAdmin
            );
            res.setHeader('token', newToken);
        }

        next();
    }
}

export enum AuthnCheck {
    Unauthorized = -1,
    Forbidden = 0,
    Authorized,
}

/**
 * Requires an authenticated request, and optionally that the user have one of the
 * roles specified.
 * 
 * If unauthenticated, halts request with 401. If no roles match,
 * halts request with 403.
 * 
 * @param roles optional set of roles, the user must have at least one of these
 */
export function userCheck(token: any, ...roles: string[]): AuthnCheck {
    if (!token.user || !token.user.sub) return AuthnCheck.Unauthorized;

    if (token.user.useExp < Math.floor(Date.now() / 1000)) {
        //TODO: generate a new token
        //TODO: replace the user in context
    }

    if (roles.length > 0) {
        const userRoles = token.user.roles as string[];
        if (!roles.some(r => userRoles.includes(r))) return AuthnCheck.Forbidden;
    }
    return AuthnCheck.Authorized;
}

/**
 * Requires an authenticated admin request, and optionally that the user have one of the
 * roles specified.
 * 
 * If unauthenticated, halts request with 401. If not an admin, halts request with 403.
 * If no roles match, halts request with 403.
 * 
 * @param roles optional set of roles, the user must have at least one of these
 */
export function adminCheck(token: any, ...roles: string[]): AuthnCheck {
    if (token === undefined) {
        return AuthnCheck.Unauthorized;
    }
    if (!token.user || !token.user.sub) return AuthnCheck.Unauthorized;
    if (!token.user.isAdmin) return AuthnCheck.Forbidden;
    if (roles.length > 0) {
        const userRoles = token.user.roles as string[];
        if (!roles.some(r => userRoles.includes(r))) return AuthnCheck.Forbidden;
    }
    return AuthnCheck.Authorized;
}


