import axios from "axios";
import { createUser, createGame, addScreenshot, addReview } from "./testing-utilities";
import { fail } from "assert";
import FormData from "form-data";
import fs from "fs";
import { test, describe, expect } from "@jest/globals";
import { expectToContainAllKeys } from "./user.test";

describe("review endpoint", function () {
    test.skip("allows users to get a list of reviews", async () => {
        const user = await createUser(false);
        const game = await createGame();
        const rv = await addReview(user, game);

        const rsp = await axios.get(`http://localhost:4201/reviews/${rv.id}`);
        expectToContainAllKeys(rsp, ["status", "data"]);
        expect(rsp.status).toStrictEqual(200);
        expect(rsp.data.length).toBeGreaterThan(1);
    });

    test("allows the user to get a review", async () => {
        const user = await createUser(false);
        const game = await createGame();
        const rv = await addReview(user, game);

        const rsp = await axios.get(`http://localhost:4201/reviews/${rv.id}`);
        expectToContainAllKeys(rsp, ["status", "data"]);
        expect(rsp.status).toStrictEqual(200);
        expect(rsp).toHaveProperty("data");
        //todo: verify data
    });

    test("allows admins to remove a review", async () => {
        const admin = await createUser(true);
        const game = await createGame();
        const rv = await addReview(admin, game);

        const rsp = await axios.patch(
            `http://localhost:4201/reviews/${rv.id}`,
            {
                removed: true,
            },
            { headers: { Authorization: "Bearer " + admin.token } },
        );
        expect(rsp).toHaveProperty("status");
        expect(rsp.status).toStrictEqual(204);
    });

    test("allows admins to restore a review", async () => {
        const admin = await createUser(true);
        const game = await createGame();
        const rv = await addReview(admin, game);

        let rsp = await axios.patch(
            `http://localhost:4201/reviews/${rv.id}`,
            { removed: true },
            { headers: { Authorization: "Bearer " + admin.token } },
        );
        expect(rsp).toHaveProperty("status");
        expect(rsp.status).toStrictEqual(204);

        rsp = await axios.patch(
            `http://localhost:4201/reviews/${rv.id}`,
            { removed: false },
            { headers: { Authorization: "Bearer " + admin.token } },
        );
        expect(rsp).toHaveProperty("status");
        expect(rsp.status).toStrictEqual(204);
    });

    test("allows the reviewer to remove their review", async () => {
        const user = await createUser(false);
        const game = await createGame();
        const rv = await addReview(user, game);

        const rsp = await axios.patch(
            `http://localhost:4201/reviews/${rv.id}`,
            { removed: true },
            { headers: { Authorization: "Bearer " + user.token } },
        );
        expect(rsp).toHaveProperty("status");
        expect(rsp.status).toStrictEqual(204);
    });

    test.skip("does not return removed reviews", async () => {
        const admin = await createUser(true);
        const user = await createUser(false);
        const game = await createGame();
        const rv = await addReview(admin, game);

        const rsp = await axios.patch(
            `http://localhost:4201/reviews/${rv.id}`,
            { removed: true },
            { headers: { Authorization: "Bearer " + admin.token } },
        );
        expect(rsp).toHaveProperty("status");
        expect(rsp.status).toStrictEqual(204);

        try {
            await axios.get(`http://localhost:4201/reviews/${rv.id}`, {
                headers: { Authorization: "Bearer " + user.token },
            });
        } catch (err) {
            expect(err).toHaveProperty("response");
            expect(err.response).toHaveProperty("status");
            expect(err.response.status).toStrictEqual(404);
            return;
        }
        return fail("get should not have been successful");
    });

    test("prevents other non-admin users from deleting a review", async () => {
        const user = await createUser(false);
        const otherUser = await createUser(false);
        const game = await createGame();
        const rv = await addReview(user, game);

        try {
            await axios.patch(
                `http://localhost:4201/reviews/${rv.id}`,
                { removed: true },
                { headers: { Authorization: "Bearer " + otherUser.token } },
            );
        } catch (err) {
            expect(err).toHaveProperty("response");
            expect(err.response).toHaveProperty("status");
            expect(err.response.status).toStrictEqual(403);
            return;
        }
        return fail("post should not have been successful");
    });

    test("allows users to like a review", async () => {
        const reviewer = await createUser(false);
        const liker = await createUser(false);
        const game = await createGame();
        const rv = await addReview(reviewer, game);

        const rsp = await axios.put(
            `http://localhost:4201/reviews/${rv.id}/likes/${liker.id}`,
            {},
            { headers: { Authorization: "Bearer " + liker.token } },
        );
        expect(rsp).toHaveProperty("status");
        expect(rsp.status).toStrictEqual(204);
    });

    test("allows users to unlike a review", async () => {
        const reviewer = await createUser(false);
        const liker = await createUser(false);
        const game = await createGame();
        const rv = await addReview(reviewer, game);

        let rsp = await axios.put(
            `http://localhost:4201/reviews/${rv.id}/likes/${liker.id}`,
            {},
            { headers: { Authorization: "Bearer " + liker.token } },
        );
        expect(rsp).toHaveProperty("status");
        expect(rsp.status).toStrictEqual(204);

        rsp = await axios.delete(`http://localhost:4201/reviews/${rv.id}/likes/${liker.id}`, {
            headers: { Authorization: "Bearer " + liker.token },
        });
        expect(rsp).toHaveProperty("status");
        expect(rsp.status).toStrictEqual(204);
    });

    test("permits multiple likes idempotently", async () => {
        const reviewer = await createUser(false);
        const liker = await createUser(false);
        const game = await createGame();
        const rv = await addReview(reviewer, game);

        let rsp = await axios.put(
            `http://localhost:4201/reviews/${rv.id}/likes/${liker.id}`,
            {},
            { headers: { Authorization: "Bearer " + liker.token } },
        );
        expect(rsp).toHaveProperty("status");
        expect(rsp.status).toStrictEqual(204);

        rsp = await axios.put(
            `http://localhost:4201/reviews/${rv.id}/likes/${liker.id}`,
            {},
            { headers: { Authorization: "Bearer " + liker.token } },
        );
        expect(rsp).toHaveProperty("status");
        expect(rsp.status).toStrictEqual(204);
    });

    test("returns multiple reviews", async () => {
        const user = await createUser(false);
        const game = await createGame();
        const game2 = await createGame();
        const rv = await addReview(user, game);
        const rv2 = await addReview(user, game2);

        const rsp = await axios.get(`http://localhost:4201/reviews`);
        expectToContainAllKeys(rsp, ["status", "data"]);
        expect(rsp.status).toStrictEqual(200);
        expect(rsp.data).toBeInstanceOf(Array);
        expect(rsp.data.length).toBeGreaterThan(1); //at least 2 results
    });
});
