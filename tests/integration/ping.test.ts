import { test, describe, expect } from "@jest/globals";
import axios from "axios";

describe("ping endpoint", function () {
	test("responds with pong", async () => {
		const rsp = await axios.get("http://localhost:4201/ping");
		expect(rsp).toHaveProperty("data");
		expect(rsp.data).toStrictEqual("pong");
	});
});
