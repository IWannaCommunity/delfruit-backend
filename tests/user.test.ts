import { test, describe, expect } from "@jest/globals";
import { fail } from "assert";
import axios from "axios";
import { createUser, genUsername } from "./testing-utilities";
import FormData from "form-data";
import moment from "moment";
var Moniker = require("moniker");

var usergen = Moniker.generator(["./tests/usernames"]);

// HACK: yoooo, wouldn't it be really COOL if there was some external,
// third party package that had this functionally. maybe we could call
// it "jest-extended" or something, and then implement a function named
// ".toContainAllKeys" to that effect. oh wait, someone did! too bad
// that it doesn't actually FUCKING work. really cool, really good
// work guys. really glad the open source community goes through
// any attempts at trying to make things that WORK before publishing
// them. ahahahahaha, so cool...
export function expectToContainAllKeys(o: Object, k: string | string[]) {
	const matcher = expect(o);
	if (Array.isArray(k)) {
		for (const prop of k) {
			matcher.toHaveProperty(prop);
		}
	} else {
		matcher.toHaveProperty(k);
	}
}

describe("user endpoint", () => {
	test("returns a 401 if the token is invalid", async () => {
		try {
			await axios.get("http://localhost:4201/users", {
				headers: { Authorization: "Bearer xyz" },
			});
		} catch (err) {
			expect(err).toHaveProperty("response");
			expect(err.response).toHaveProperty("status");
			expect(err.response.status).toStrictEqual(401);
			return;
		}
		fail("token was taken as valid");
	});

	test("allows a user to be registered", async () => {
		const usernameA = genUsername();

		const resp = await axios.post("http://localhost:4201/users", {
			username: usernameA,
			password: "test-pw",
			email: "test@example.com",
		});

		expectToContainAllKeys(resp, ["status", "data"]);
		expect(resp.status).toStrictEqual(201);
		expectToContainAllKeys(resp.data, ["id", "email", "token", "isAdmin"]);
		expect(typeof resp.data.id).toBe("number");
		expect(resp.data.email).toStrictEqual("test@example.com");
		expect(typeof resp.data.token).toBe("string");
		expect(resp.data.isAdmin).toStrictEqual(false);
	});

	test("rejects registration via form parameters", async () => {
		const usernameA = genUsername();
		let bodyFormData = new FormData();
		bodyFormData.append("userName", usernameA);
		bodyFormData.append("password", "test-pw");
		bodyFormData.append("email", "test@example.com");

		try {
			const rsp = await axios.post("http://localhost:4201/users", bodyFormData);
			return fail("registration should not have been successful");
		} catch (err) {
			expect(err).toHaveProperty("response");
			expect(err.response).toHaveProperty("status");
			expect(err.response.status).toStrictEqual(400);
			expect(err.response.data).toEqual(
				'Invalid request: expected a JSON body of the format {"username":"example","password":"example","email":"example@example.com"}',
			);
		}
	});

	test("rejects existing users", async () => {
		const user = await createUser(false);

		//second, should fail
		try {
			await axios.post("http://localhost:4201/users", {
				username: user.username,
				password: "test-pw",
				email: "test@example.com",
			});
			return fail("second registration should not have been successful");
		} catch (err) {
			expect(err).toHaveProperty("response");
			expect(err.response).toHaveProperty("status");
			expect(err.response.status).toStrictEqual(400);
		}
	});

	test("returns user information", async () => {
		const rsp = await axios.get("http://localhost:4201/users/1");
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);
		expectToContainAllKeys(rsp.data, ["id", "name"]);
		expect(rsp.data.id).toStrictEqual(1);
		expect(typeof rsp.data.name).toBe("string");
	});

	test("allows modification of your own user", async () => {
		const u = await createUser(false);

		//update
		const patch = await axios.patch(
			`http://localhost:4201/users/${u.id}`,
			{ email: "new@example.com" },
			{ headers: { Authorization: "Bearer " + u.token } },
		);
		expectToContainAllKeys(patch, ["status", "data"]);
		expect(patch.status).toStrictEqual(200);
		expectToContainAllKeys(patch.data, ["email", "id"]);
		expect(patch.data.email).toStrictEqual("new@example.com");
		expect(patch.data.id).toStrictEqual(u.id);

		//verify
		const user = await axios.get(`http://localhost:4201/users/${u.id}`, {
			headers: { Authorization: "Bearer " + u.token },
		});
		expectToContainAllKeys(user, ["status", "data"]);
		expect(user.status).toStrictEqual(200);
		expectToContainAllKeys(user.data, ["email", "id"]);
		expect(user.data.email).toStrictEqual("new@example.com");
		expect(user.data.id).toStrictEqual(u.id);
	});

	test("does not allow modification of a different user", async () => {
		const Alice = await createUser(false);
		const Bob = await createUser(false);

		try {
			await axios.patch(
				`http://localhost:4201/users/${Alice.id}`,
				{ email: "new@example.com" },
				{ headers: { Authorization: "Bearer " + Bob.token } },
			);
			return fail("modify should not have been successful");
		} catch (err) {
			expect(err).toHaveProperty("response");
			expect(err.response).toHaveProperty("status");
			expect(err.response.status).toStrictEqual(403);
		}
	});

	test("does not allow modification user if not logged in", async () => {
		const user = await createUser(false);

		try {
			await axios.patch(`http://localhost:4201/users/${user.id}`, {
				email: "new@example.com",
			});
			fail("modify should not have been successful");
		} catch (err) {
			expect(err).toHaveProperty("response");
			expect(err.response).toHaveProperty("status");
			expect(err.response.status).toStrictEqual(401);
		}
	});

	test("allows password change", async () => {
		const user = await createUser(false);

		//update
		const patch = await axios.patch(
			`http://localhost:4201/users/${user.id}`,
			{ password: "new-pw", currentPassword: "test-pw" },
			{ headers: { Authorization: "Bearer " + user.token } },
		);
		expect(patch).toHaveProperty("status");
		expect(patch.status).toStrictEqual(200);

		//verify login
		const login = await axios.post("http://localhost:4201/auth/login", {
			username: user.username,
			password: "new-pw",
		});
		expect(login).toHaveProperty("status");
		expect(login.status).toStrictEqual(200);
	});

	test("rejects password change if current password incorrect", async () => {
		const user = await createUser(false);

		//update
		try {
			const patch = await axios.patch(
				`http://localhost:4201/users/${user.id}`,
				{ password: "new-pw", currentPassword: "not-correct-password" },
				{ headers: { Authorization: "Bearer " + user.token } },
			);
			fail("modify should not have been successful");
		} catch (err) {
			expect(err).toHaveProperty("response");
			expect(err.response).toHaveProperty("status");
			expect(err.response.status).toStrictEqual(401);
		}
	});

	test("rejects password change if current password not provided", async () => {
		const user = await createUser(false);

		//update
		try {
			const patch = await axios.patch(
				`http://localhost:4201/users/${user.id}`,
				{ password: "new-pw" },
				{ headers: { Authorization: "Bearer " + user.token } },
			);
			return fail("modify should not have been successful");
		} catch (err) {
			expect(err).toHaveProperty("response");
			expect(err.response).toHaveProperty("status");
			expect(err.response.status).toStrictEqual(401);
		}
	});

	test("gets lists for a user", async () => {
		const user = await createUser(false);

		const rsp = await axios.get(
			`http://localhost:4201/users/${user.id}/lists`,
			{
				headers: { Authorization: "Bearer " + user.token },
			},
		);
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);
		expect(rsp.data).toBeInstanceOf(Array);
	});

	test("allows a user to follow another user", async () => {
		const user = await createUser(false);
		const targetUser = await createUser(false);

		const rsp = await axios.put(
			`http://localhost:4201/users/${user.id}/follows/${targetUser.id}`,
			{},
			{ headers: { Authorization: "Bearer " + user.token } },
		);
		expect(rsp).toHaveProperty("status");
		expect(rsp.status).toStrictEqual(204);
	});

	test("allows a user to unfollow another user", async () => {
		const user = await createUser(false);
		const targetUser = await createUser(false);

		let rsp = await axios.put(
			`http://localhost:4201/users/${user.id}/follows/${targetUser.id}`,
			{},
			{ headers: { Authorization: "Bearer " + user.token } },
		);
		expect(rsp).toHaveProperty("status");
		expect(rsp.status).toStrictEqual(204);

		rsp = await axios.delete(
			`http://localhost:4201/users/${user.id}/follows/${targetUser.id}`,
			{
				headers: { Authorization: "Bearer " + user.token },
			},
		);
		expect(rsp).toHaveProperty("status");
		expect(rsp.status).toStrictEqual(204);
	});

	test("does not expose sensitive user data to other users", async () => {
		const hacker = await createUser(false);
		const victim = await createUser(false);

		let rsp = await axios.get(`http://localhost:4201/users/${victim.id}`, {
			headers: { Authorization: "Bearer " + hacker.token },
		});
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);

		//complete whitelist
		//add members if public data is added to the user
		expectToContainAllKeys(rsp.data, [
			"id",
			"name",
			"dateCreated",
			"isAdmin",
			"twitchLink",
			"nicoLink",
			"youtubeLink",
			"twitterLink",
			"bio",
			"selected_badge",
		]);
	});

	test("does not expose sensitive user data to anons", async () => {
		const victim = await createUser(false);

		let rsp = await axios.get(`http://localhost:4201/users/${victim.id}`);
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);

		//complete whitelist
		//add members if public data is added to the user
		expectToContainAllKeys(rsp.data, [
			"id",
			"name",
			"dateCreated",
			"isAdmin",
			"twitchLink",
			"nicoLink",
			"youtubeLink",
			"twitterLink",
			"bio",
			"selected_badge",
		]);
	});

	test("does not expose sensitive user data on the user list to anons", async () => {
		await createUser(false);

		let rsp = await axios.get(`http://localhost:4201/users`);
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);
		expect(rsp.data).toBeInstanceOf(Array);
		expect(rsp.data).toHaveProperty("length");
		expect(rsp.data.length).toBeGreaterThan(0);

		//complete whitelist
		//add members if public data is added to the user
		expectToContainAllKeys(rsp.data[0], [
			"id",
			"name",
			"dateCreated",
			"isAdmin",
			"twitchLink",
			"nicoLink",
			"youtubeLink",
			"twitterLink",
			"bio",
			"selected_badge",
		]);
	});

	test("allows retrieval of available badge list", async () => {
		const user = await createUser(false);

		let rsp = await axios.get(`http://localhost:4201/users/${user.id}/badges`, {
			headers: { Authorization: "Bearer " + user.token },
		});
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);
		expect(rsp.data).toBeInstanceOf(Array);
	});

	test("allows searching for user by name", async () => {
		const user = await createUser(false);

		let rsp = await axios.get(`http://localhost:4201/users`, {
			headers: { Authorization: "Bearer " + user.token },
			params: { name: user.username.substring(3, 10) },
		});
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);
		expect(rsp.data).toBeInstanceOf(Array);
		expect(
			(rsp.data as any[]).find((u) => u.name === user.username),
		).toBeDefined();
	});

	test("includes permissions for self", async () => {
		const user = await createUser(true);

		let rsp = await axios.get(`http://localhost:4201/users/${user.id}`, {
			headers: { Authorization: "Bearer " + user.token },
		});
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);
		expect(rsp.data).toHaveProperty("permissions");
	});

	test("includes permissions for admins", async () => {
		const user = await createUser(true);
		const target_user = await createUser(false);

		let rsp = await axios.get(`http://localhost:4201/users/${target_user.id}`, {
			headers: { Authorization: "Bearer " + user.token },
		});
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);
		expect(rsp.data).toHaveProperty("permissions");
	});

	test("doesn't include permissions if it's not you", async () => {
		const user = await createUser(false);
		const target_user = await createUser(false);

		let rsp = await axios.get(`http://localhost:4201/users/${target_user.id}`, {
			headers: { Authorization: "Bearer " + user.token },
		});
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);
		expect(rsp.data).not.toHaveProperty("permissions");
	});

	test("shows revoked permissions", async () => {
		const user = await createUser(true);
		const target_user = await createUser(false);
		const perm = "CAN_REPORT";
		let revokeRsp = await axios.patch(
			`http://localhost:4201/users/${target_user.id}/permissions/${perm}`,
			{ revokedUntil: moment().add(1, "days") },
			{ headers: { Authorization: "Bearer " + user.token } },
		);
		expect(revokeRsp).toHaveProperty("status");
		expect(revokeRsp.status).toStrictEqual(200);

		let rsp = await axios.get(`http://localhost:4201/users/${target_user.id}`, {
			headers: { Authorization: "Bearer " + user.token },
		});
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);
		expect(rsp.data).toHaveProperty("permissions");
		expect(rsp.data.permissions).toHaveProperty(perm);
		expect(rsp.data.permissions[perm]).toHaveProperty("revoked_until");
		expect(
			moment(rsp.data.permissions[perm].revoked_until).isAfter(moment()),
		).toBeTruthy();
	});
});
