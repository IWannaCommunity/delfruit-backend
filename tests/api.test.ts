import axios from "axios";
import { test, describe, expect } from "@jest/globals";
import { assertAxiosError, assertAxiosRequest, createUser } from "./testing-utilities";

describe("api controller", () => {
    test("returns a 401 if the token is invalid", async () => {
        try {
            await axios.get("http://localhost:4201/api/users", { headers: { "Authorization": "Bearer xyz" } });
        } catch (e: any) {
            assertAxiosError(e, 401);
        }
    });

    test("returns a 403 if the user isn't an admin", async () => {
        const user = await createUser(false);
        try {
            await axios.get("http://localhost:4201/api/users", { headers: { "Authorization": "Bearer " + user.token } });
        } catch (e: any) {
            assertAxiosError(e, 403);
        }
    });

    test("returns user list if user is an admin", async () => {
        const user = await createUser(true);
        const rsp = await axios.get("http://localhost:4201/api/users", { headers: { "Authorization": "Bearer " + user.token } });
        assertAxiosRequest(rsp, 200);
        expect(rsp).toHaveProperty("data");
    });
});
