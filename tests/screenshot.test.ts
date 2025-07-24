import axios from "axios";
import {
	createUser,
	createGame,
	addScreenshot,
	hasPermission,
} from "./testing-utilities";
import { fail } from "assert";
import FormData from "form-data";
import fs from "fs";
import { Permission } from "../src/model/Permission";
import { test, describe, expect } from "@jest/globals";
import { expectToContainAllKeys } from "./user.test";

describe("screenshot endpoint", () => {
	test("allows users to get a list of screenshots", async () => {
		const user = await createUser(false);
		const game = await createGame();
		const ss = await addScreenshot(user, game);

		const rsp = await axios.get(`http://localhost:4201/screenshots`);
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);
		// TODO: check if array contains the new screenshot
	});

	test("allows the user to get a screenshot", async () => {
		const user = await createUser(false);
		const game = await createGame();
		const ss = await addScreenshot(user, game);

		const rsp = await axios.get(`http://localhost:4201/screenshots/${ss.id}`);
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);
		//todo: check if object equals created screenshot
	});

	test("allows admins to remove a screenshot", async () => {
		const admin = await createUser(true);
		const game = await createGame();
		const ss = await addScreenshot(admin, game);

		const rsp = await axios.delete(
			`http://localhost:4201/screenshots/${ss.id}`,
			{
				headers: { Authorization: "Bearer " + admin.token },
			},
		);
		expect(rsp).toHaveProperty("status");
		expect(rsp.status).toStrictEqual(204);
	});

	test("grants auto-approve once the approve threshold has been met", async function () {
		// QUEST: I don't think we need timeout anymore with jest, it might have a default test timeout?
		//this.timeout(3000); //took 1205 in my test
		const admin = await createUser(true);
		const user = await createUser(false);
		const game = await createGame();
		//create and approve 10 screenshots
		for (let i = 0; i < 10; i++) {
			const ss = await addScreenshot(user, game);
			await axios.patch(
				`http://localhost:4201/screenshots/${ss.id}`,
				{ approved: true },
				{ headers: { Authorization: "Bearer " + admin.token } },
			);

			if (i === 8) {
				//one before end
				const hadPerm = await hasPermission(
					user,
					Permission.AUTO_APPROVE_SCREENSHOT,
				);
				expect(hadPerm).toBeFalsy();
			}
		}

		const hadPerm = await hasPermission(
			user,
			Permission.AUTO_APPROVE_SCREENSHOT,
		);
		expect(hadPerm).toBeTruthy();
	});

	test("prevents non-admins from deleting a screenshot", async () => {
		const admin = await createUser(false);
		const game = await createGame();
		const ss = await addScreenshot(admin, game);

		try {
			await axios.delete(`http://localhost:4201/screenshots/${ss.id}`, {
				headers: { Authorization: "Bearer " + admin.token },
			});
		} catch (err) {
			expect(err).toHaveProperty("response");
			expect(err.response).toHaveProperty("status");
			expect(err.response.status).toStrictEqual(403);
			return;
		}
		fail("get should not have been successful");
	});

	test("prevents anons from creating a screenshot", async () => {
		const game = await createGame();

		let data = new FormData();

		data.append("description", "super neat screenshot");
		data.append("screenshot", fs.createReadStream(__dirname + "/HYPE.png"));

		try {
			await axios.post(
				`http://localhost:4201/games/${game.id}/screenshots`,
				data,
				{
					headers: data.getHeaders(),
				},
			);
		} catch (err) {
			expect(err).toHaveProperty("response");
			expect(err.response).toHaveProperty("status");
			expect(err.response.status).toStrictEqual(401);
			return;
		}
		fail("get should not have been successful");
	});

	test("allows admins to approve a screenshot", async () => {
		const user = await createUser(true);
		const game = await createGame();
		const ss = await addScreenshot(user, game);
		expect(ss).toHaveProperty("approved");
		expect(ss.approved).toBeNull();

		let rsp = await axios.patch(
			`http://localhost:4201/screenshots/${ss.id}`,
			{
				approved: true,
			},
			{ headers: { Authorization: "Bearer " + user.token } },
		);
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);
		expect(rsp.data).toHaveProperty("approved");
		expect(rsp.data.approved).toStrictEqual(true);

		rsp = await axios.get(`http://localhost:4201/screenshots/${ss.id}`);
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);
		expect(rsp.data).toHaveProperty("approved");
		expect(rsp.data.approved).toStrictEqual(true);
	});

	test("allows admins to deny a screenshot", async () => {
		const user = await createUser(true);
		const game = await createGame();
		const ss = await addScreenshot(user, game);
		expect(ss).toHaveProperty("approved");
		expect(ss.approved).toBeNull();

		let rsp = await axios.patch(
			`http://localhost:4201/screenshots/${ss.id}`,
			{
				approved: false,
			},
			{ headers: { Authorization: "Bearer " + user.token } },
		);
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);
		expect(rsp.data).toHaveProperty("approved");
		expect(rsp.data.approved).toStrictEqual(false);
	});

	test("does not return screenshots until approved", async () => {
		const user = await createUser(false);
		const admin = await createUser(true);
		const game = await createGame();
		const ss = await addScreenshot(user, game);
		expect(ss).toHaveProperty("approved");
		expect(ss.approved).toBeNull();

		try {
			await axios.get(`http://localhost:4201/screenshots/${ss.id}`);
		} catch (err) {
			expect(err).toHaveProperty("response");
			expect(err.response).toHaveProperty("status");
			expect(err.response.status).toStrictEqual(404);
			return;
		}

		let rsp = await axios.patch(
			`http://localhost:4201/screenshots/${ss.id}`,
			{
				approved: true,
			},
			{ headers: { Authorization: "Bearer " + admin.token } },
		);

		rsp = await axios.get(`http://localhost:4201/screenshots/${ss.id}`);
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);
		expect(rsp.data).toHaveProperty("approved");
		expect(rsp.data.approved).toStrictEqual(true);
	});

	test("prevents anons from approving a screenshot", async () => {
		const user = await createUser(true);
		const game = await createGame();
		const ss = await addScreenshot(user, game);
		expect(ss).toHaveProperty("approved");
		expect(ss.approved).toBeNull();

		try {
			await axios.patch(`http://localhost:4201/screenshots/${ss.id}`, {
				approved: true,
			});
		} catch (err) {
			expect(err).toHaveProperty("response");
			expect(err.response);
			expect(err.response.status).toStrictEqual(401);
			return;
		}
		fail("get should not have been successful");
	});

	test("prevents users from approving a screenshot", async () => {
		const user = await createUser(false);
		const game = await createGame();
		const ss = await addScreenshot(user, game);
		expect(ss).toHaveProperty("approved");
		expect(ss.approved).toBeNull();

		try {
			await axios.patch(
				`http://localhost:4201/screenshots/${ss.id}`,
				{
					approved: true,
				},
				{ headers: { Authorization: "Bearer " + user.token } },
			);
		} catch (err) {
			expect(err).toHaveProperty("response");
			expect(err.response);
			expect(err.response.status).toStrictEqual(403);
			return;
		}
		fail("get should not have been successful");
	});
});
