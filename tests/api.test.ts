import axios from "axios";
import { test, describe, expect } from "@jest/globals";
import { createUser } from "./testing-utilities";

describe("api controller", () => {
    test("returns a 401 if the token is invalid", async () => {
        try {
            await axios.get("http://localhost:4201/api/users", { header: { "Authorization": "Bearer xyz" } });
        } catch (e: any) {
            expect(e).toHaveProperty("response");
            expect(e.response).toHaveProperty("status");
            expect(e.response.status).toStrictEqual(401);
        }
    });

    test("returns a 403 if the user isn't an admin", async () => {
        const user = await createUser(false);
        try {
            await axios.get("http://localhost:4201/api/users", { header: { "Authorization": "Bearer " + user.token } });
        } catch (e: any) {
            expect(e).toHaveProperty("response");
            expect(e.response).toHaveProperty("status");
            expect(e.response.status).toStrictEqual(403);
        }
    });

    test("returns user list if user is an admin", async () => {
        const user = await createUser(true);
        const rsp = await axios.get("http://localhost:4201/api/users", { headers: { "Authorization": "Bearer " + user.token } });
        expect(rsp).toHaveProperty("status")
        expect(rsp.status).toStrictEqual(200);
        expect(rsp).toHaveProperty("data");
    });
});
