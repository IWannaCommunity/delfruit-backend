import axios from "axios";
import { fail } from "assert";
import { createUser } from "./testing-utilities";
import FormData from "form-data";
var Moniker = require("moniker");
import { expectToContainAllKeys } from "./user.test";
import { test, describe, expect } from "@jest/globals";

var taggen = Moniker.generator([Moniker.adjective]);

function randomName() {
	return taggen.choose();
}

describe("tag endpoint", function () {
	test("prevents anons from creating tags", async () => {
		try {
			await axios.post("http://localhost:4201/tags", { name: randomName() });
		} catch (err) {
			expect(err).toHaveProperty("response");
			expect(err.response).toHaveProperty("status");
			expect(err.response.status).toStrictEqual(401);
			return;
		}
		return fail("should not have worked");
	});

	test("allows users to create tags", async () => {
		const user = await createUser(false);

		const nm = randomName();

		const rsp = await axios.post(
			"http://localhost:4201/tags",
			{ name: nm },
			{ headers: { Authorization: "Bearer " + user.token } },
		);

		expectToContainAllKeys(rsp, ["status", "data"]);
		expect(rsp.status).toStrictEqual(200);
		expectToContainAllKeys(rsp.data, ["id", "name"]);
		expect(typeof rsp.data.id).toStrictEqual("number");
		expect(rsp.data.name).toStrictEqual(nm);
	});

	test("allows searching of tags starting with name", async () => {
		const user = await createUser(false);

		const nm = randomName();

		const rsp = await axios.post(
			"http://localhost:4201/tags",
			{ name: nm },
			{ headers: { Authorization: "Bearer " + user.token } },
		);
		expect(rsp).toHaveProperty("status");
		expect(rsp.status).toStrictEqual(200);

		const rsp2 = await axios.get(
			`http://localhost:4201/tags?q=${nm.substr(1, 15)}`,
		);
		expectToContainAllKeys(rsp2, ["status", "data"]);
		expect(rsp2.status).toStrictEqual(200);
		expect(rsp2.data).toBeInstanceOf(Array);
		expect(rsp2.data.length).toBeGreaterThan(0);
		expect(rsp2.data[0]).toHaveProperty("name");
		expect(rsp2.data[0].name).toStrictEqual(nm);
	});
});
