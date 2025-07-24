import axios from "axios";
import { fail, ok } from "assert";
import { createUser, setUserToken, genUsername } from "./testing-utilities";
import AuthModule from "../src/lib/auth";
import { expectToContainAllKeys } from "./user.test";
import jwt from "jsonwebtoken";

describe("auth endpoint", function () {
	const usernameA = genUsername();

	test("allows the user to log in", async () => {
		//register
		const reg = await axios.post("http://localhost:4201/users", {
			username: usernameA,
			password: "test-pw",
			email: "test@example.com",
		});
		expectToContainAllKeys(reg, ["status", "data"]);
		expect(reg.status).toStrictEqual(201);
		expect(reg.data).toHaveProperty("token");
		expect(typeof reg.data.token).toStrictEqual("string");

		//login
		const login = await axios.post("http://localhost:4201/auth/login", {
			username: usernameA,
			password: "test-pw",
		});
		expectToContainAllKeys(login, ["status", "data"]);
		expect(login.status).toStrictEqual(200);
		expect(login.data).toHaveProperty("token");
		expect(typeof login.data.token).toStrictEqual("string");
	});

	test.skip("doesn't allow login with a bad password", async () => {
		const user = await createUser(false);

		//login
		try {
			await axios.post("http://localhost:4201/auth/login", {
				username: user.username,
				password: "this is the wrong password",
			});
		} catch (err) {
			expect(err).toHaveProperty("response");
			expect(err.response).toHaveProperty("status");
			expect(err.response.status).toStrictEqual(401);
			return ok({});
		}
	});

	test(
		"allows the user to refresh their token",
		async () => {
			const user = await createUser(false);

			//login
			const result = await axios.post(
				"http://localhost:4201/auth/refresh",
				{},
				{ headers: { Authorization: "Bearer " + user.token } },
			);
			expectToContainAllKeys(result, ["status", "data"]);
			expect(result.status).toStrictEqual(200);
			expect(result.data).toHaveProperty("token");
			expect(typeof result.data.token).toStrictEqual("string");
			expect(user.token).not.toStrictEqual(result.data.token);
			//TODO: assert expiration date is newer than original token
		},
		1000 * 20,
	);

	test(
		"sends a new token in the response header",
		async () => {
			const user = await createUser(false);

			//login
			const login = await axios.post("http://localhost:4201/auth/login", {
				username: user.username,
				password: user.password,
			});
			expectToContainAllKeys(login, ["status", "data"]);
			expect(login.status).toStrictEqual(200);
			expect(login.data).toHaveProperty("token");
			expect(typeof login.data.token).toStrictEqual("string");
			expect(login.headers).toHaveProperty("token");
			expect(typeof login.headers.token).toStrictEqual("string");
		},
		1000 * 20,
	);

	test("refreshes the token with each request", async () => {
		const user = await createUser(false);

		const auth = new AuthModule();
		const originalToken = <any>jwt.verify(user.token, auth.getSecret());

		//wait a second so the new timeout is later
		await new Promise((res) => setTimeout(res, 1100));

		const rsp = await axios.get("http://localhost:4201/users", {
			headers: { Authorization: "Bearer " + user.token },
		});
		expectToContainAllKeys(rsp, ["status", "headers"]);
		expect(rsp.status).toStrictEqual(200);
		expect(rsp.headers).toHaveProperty("token");
		expect(typeof rsp.headers.token).toStrictEqual("string");
		const newToken = <any>jwt.verify(rsp.headers.token, auth.getSecret());
		expectToContainAllKeys(newToken, ["exp", "useExp"]);
		expect(newToken.useExp).toBeGreaterThan(originalToken.useExp);
		expect(newToken.exp).toBeGreaterThan(originalToken.exp);
	});

	test("allows the user to request a password reset", async () => {
		const user = await createUser(false);

		//login
		const login = await axios.post("http://localhost:4201/auth/request-reset", {
			username: user.username,
			email: user.email,
		});
		expect(login).toHaveProperty("status");
		//expect(login.status).toStrictEqual(204);
		expect(login.status).toStrictEqual(200);
	});

	test("doesn't allow password reset request without email", async () => {
		const user = await createUser(false);
		try {
			await axios.post("http://localhost:4201/auth/reset-request", {
				username: user.username,
			});
		} catch (err) {
			expect(err).toHaveProperty("response");
			expect(err.response).toHaveProperty("status");
			expect(err.response.status).toStrictEqual(400);
			return ok({});
		}
		return fail("reset should not have been successful");
	});

	test.skip("doesn't allow password reset for blank requests", async () => {
		try {
			await axios.post("http://localhost:4201/auth/reset", {});
		} catch (err) {
			expect(err).toHaveProperty("response");
			expect(err.response).toHaveProperty("status");
			expect(err.response.status).toStrictEqual(401);
			return;
		}
		return fail("reset should not have been successful");
	});

	test.skip(
		"allows the user to reset their password",
		async () => {
			const user = await createUser(false);

			await setUserToken(user, "test-token");

			const req = await axios.post("http://localhost:4201/auth/reset", {
				username: user.username,
				token: "test-token",
				password: "new-password",
			});
			expectToContainAllKeys(req, ["status", "data", "headers"]);
			expect(req.status).toStrictEqual(200);
			expect(req.headers).toHaveProperty("token");
			expect(typeof req.headers.token).toStrictEqual("string");
			expect(req.data).toHaveProperty("token");
			expect(typeof req.data.token).toStrictEqual("string");
		},
		1000 * 25,
	);
});
