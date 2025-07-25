import axios from "axios";
import { fail } from "assert";
import { test, describe, expect } from "@jest/globals";
import {
	createUser,
	createGame,
	expectToContainAllKeys,
} from "./testing-utilities";
import { Report } from "../src/model/Report";

async function createReport(parameters?: any): Promise<Report> {
	const user = await createUser(false);
	const game = await createGame();

	if (parameters == undefined) {
		parameters = {
			report: "game sux",
			type: "game",
			targetId: game.id,
		};
	}

	const rsp = await axios.post("http://localhost:4201/reports", parameters, {
		headers: { Authorization: "Bearer " + user.token },
	});
	expectToContainAllKeys(rsp, ["status", "data"]);
	expect(rsp.status).toStrictEqual(201);
	return rsp.data as Report;
}

describe("report endpoint", function () {
	test("allows anyone to add reports", async () => {
		const user = await createUser(false);

		const rsp = await axios.post(
			"http://localhost:4201/reports",
			{
				report: "game sux",
				type: "game",
				targetId: 1,
			},
			{ headers: { Authorization: "Bearer " + user.token } },
		);
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(201);
		expectToContainAllKeys(rsp.data, [
			"id",
			"targetId",
			"type",
			"report",
			"dateCreated",
			"reporterId",
		]);
		expect(typeof rsp.data.id).toStrictEqual("number");
		expect(rsp.data.targetId).toStrictEqual(1);
		expect(rsp.data.type).toStrictEqual("game");
		expect(rsp.data.report).toStrictEqual("game sux");
		expect(typeof rsp.data.dateCreated).toStrictEqual("string");
		expect(rsp.data.reporterId).toStrictEqual(user.id);
	});

	test("prevents anons from viewing reports", async () => {
		try {
			await axios.get("http://localhost:4201/reports");
		} catch (err) {
			expect(err).toHaveProperty("response");
			expect(err.response).toHaveProperty("status");
			expect(err.response.status).toStrictEqual(401);
			return;
		}
		fail("get should have failed");
	});

	test("prevents users from viewing reports", async () => {
		const user = await createUser(false);
		try {
			await axios.get("http://localhost:4201/reports", {
				headers: { Authorization: "Bearer " + user.token },
			});
		} catch (err) {
			expect(err).toHaveProperty("response");
			expect(err.response).toHaveProperty("status");
			expect(err.response.status).toStrictEqual(403);
			return;
		}
		fail("get should have failed");
	});

	test("returns a list of reports for admins", async () => {
		const admin = await createUser(true);
		await createReport();

		const rsp = await axios.get("http://localhost:4201/reports", {
			headers: { Authorization: "Bearer " + admin.token },
		});
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);
		expect(rsp.data).toBeInstanceOf(Array);
	});

	test("allows admins to filter reports by type", async () => {
		const admin = await createUser(true);
		const report = await createReport({
			report: "admin sux",
			type: "user",
			targetId: admin.id,
		});

		let rsp = await axios.get("http://localhost:4201/reports", {
			params: { type: "user", id: report.id },
			headers: { Authorization: "Bearer " + admin.token },
		});
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);
		expect(rsp.data).toBeInstanceOf(Array);
		const matchedReports = rsp.data as Report[];

		rsp = await axios.get("http://localhost:4201/reports", {
			params: { type: "game", id: report.id },
			headers: { Authorization: "Bearer " + admin.token },
		});
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);
		expect(rsp.data).toBeInstanceOf(Array);
		const unmatchedReports = rsp.data as Report[];

		return (
			/* @ts-ignore */
			expect(matchedReports.find((o) => o.id == report.id)).toBeDefined() &&
			expect(unmatchedReports.find((o) => o.id == report.id)).toBeDefined()
		);
	});

	test("returns a report by id for admins", async () => {
		const admin = await createUser(true);
		const report = await createReport();

		const rsp = await axios.get(`http://localhost:4201/reports/${report.id}`, {
			headers: { Authorization: "Bearer " + admin.token },
		});
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);
		expect(rsp.data).toHaveProperty("id");
		expect(rsp.data.id).toStrictEqual(report.id);
	});

	test("allows admins to update reports", async () => {
		const admin = await createUser(true);
		const report = await createReport();

		const rsp = await axios.patch(
			`http://localhost:4201/reports/${report.id}`,
			{ answeredById: admin.id },
			{ headers: { Authorization: "Bearer " + admin.token } },
		);
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);
		expectToContainAllKeys(rsp.data, ["id", "answeredById"]);
		expect(rsp.data.id).toStrictEqual(report.id);
		expect(rsp.data.answeredById).toStrictEqual(admin.id);
	});

	test("prevents users from updating reports", async () => {
		const user = await createUser(false);
		const report = await createReport();

		try {
			await axios.patch(
				`http://localhost:4201/reports/${report.id}`,
				{ answeredById: user.id },
				{ headers: { Authorization: "Bearer " + user.token } },
			);
		} catch (err) {
			expect(err).toHaveProperty("response");
			expect(err.response).toHaveProperty("status");
			expect(err.response.status).toStrictEqual(403);
			return;
		}
		fail("get should have failed");
	});
});
