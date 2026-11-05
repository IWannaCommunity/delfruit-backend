import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import express from "express";
import { SemVer } from "semver";
import { Controller, Get, Response, Route, SuccessResponse, Tags } from "tsoa";
import handle from "../lib/express-async-catch";
import type { Config } from "../model/config";

const config: Config = require("../config/config.json");

type GitInfo = {
	commit: string;
	shortCommit: string;
	branch: string;
	tag: string;
	nearestTag: string;
	dirty: boolean;
};

type VersionInfo = {
	app: string;
	env?: string;
	git?: GitInfo;
};

function git(cmd: string): string | null {
	try {
		return (
			execSync(`git ${cmd}`, {
				encoding: "utf8",
				stdio: ["ignore", "pipe", "ignore"],
			}).trim() || null
		);
	} catch {
		return null;
	}
}

const VERSIONINFO = (() => {
	const devMode = config.developerMode ?? false;
	return Object.freeze({
		app: new SemVer(process.env.npm_package_version).toString(),
		env: devMode ? process.env.NODE_ENV : void 0,
		git: devMode
			? {
					commit: git("rev-parse HEAD"),
					shortCommit: git("rev-parse --short HEAD"),
					branch: git("rev-parse --abbrev-ref HEAD"),
					tag: git("describe --tags --exact-match"),
					nearestTag: git("describe --tags --abbrev=0"),
					dirty: git("status --porcelain").length > 0,
				}
			: void 0,
	});
})();

@Route("ping")
export class PingController extends Controller {
	@SuccessResponse(200, "Pong")
	@Get()
	public async getPing(): Promise<string> {
		return "pong";
	}

	@SuccessResponse(200, "Version of the application.")
	@Get("/version")
	public async getVersion(): Promise<VersionInfo> {
		return VERSIONINFO;
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
