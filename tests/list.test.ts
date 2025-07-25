import axios from "axios";
import { test, describe, expect } from "@jest/globals";
import { fail } from "assert";
import { createUser, expectToContainAllKeys } from "./testing-utilities";

describe("list endpoint", function () {
	test("allows users to create a list", async () => {
		const user = await createUser(false);
		const rsp = await axios.post(
			"http://localhost:4201/lists",
			{
				name: "new list",
				description: "very new list",
			},
			{ headers: { Authorization: "Bearer " + user.token } },
		);
		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(201);
		expectToContainAllKeys(rsp.data, ["id", "name", "description", "userId"]);
		expect(typeof rsp.data.id).toStrictEqual("number");
		expect(rsp.data.name).toStrictEqual("new list");
		expect(rsp.data.description).toStrictEqual("very new list");
		expect(rsp.data.userId).toStrictEqual(user.id);
	});

	test.skip("allows users to add games to a list", async () => {});

	test.skip("allows users to remove games from a list", async () => {});

	test.skip("rejects adding games that do not exist", async () => {});

	test.skip("rejects adding games to a list that does not exist", async () => {});

	test("requires you to be logged in", async () => {
		try {
			await axios.post("http://localhost:4201/lists", {
				name: "new list",
			});
		} catch (err) {
			expect(err).toHaveProperty("response");
			expect(err.response).toHaveProperty("status");
			expect(err.response.status).toStrictEqual(401);
			return;
		}
		return fail("add should not have been successful");
	});
});
