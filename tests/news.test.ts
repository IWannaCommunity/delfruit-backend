import axios from "axios";
import { fail, ok } from "assert";
import { createUser, createGame, addReview } from "./testing-utilities";
import FormData from "form-data";
import fs from "fs";
import { hashSync } from "bcrypt";
import { News } from "../src/model/News";
import { expectToContainAllKeys } from "./user.test";
import { test, describe, expect } from "@jest/globals";

async function createNews(): Promise<News> {
    const admin = await createUser(true);

    const rsp = await axios.post(
        "http://localhost:4201/news",
        {
            title: "news title",
            short: "check me out",
            news: "long news article",
        },
        { headers: { Authorization: "Bearer " + admin.token } },
    );
    expectToContainAllKeys(rsp, ["status", "data"]);
    expect(rsp.status).toStrictEqual(201);
    return rsp.data as News;
}

describe("news endpoint", function () {
    test("allows admins to add news", async () => {
        const admin = await createUser(true);

        const rsp = await axios.post(
            "http://localhost:4201/news",
            {
                title: "news title",
                short: "check me out",
                news: "long news article",
            },
            { headers: { Authorization: "Bearer " + admin.token } },
        );
        expectToContainAllKeys(rsp, ["status", "data"]);
        expect(rsp.status).toStrictEqual(201);
        expectToContainAllKeys(rsp.data, ["id", "posterId", "title", "short", "news", "dateCreated"]);
        expect(typeof rsp.data.id).toStrictEqual("number");
        expect(rsp.data.posterId).toStrictEqual(admin.id);
        expect(rsp.data.title).toStrictEqual("news title");
        expect(rsp.data.short).toStrictEqual("check me out");
        expect(rsp.data.news).toStrictEqual("long news article");
        expect(typeof rsp.data.dateCreated).toStrictEqual("string");
    });

    test.skip("allows admins to edit news", () => {});

    test("allows admins to remove news", async () => {
        const news = await createNews();
        const admin = await createUser(true);

        const rsp = await axios.delete(`http://localhost:4201/news/${news.id}`, {
            headers: { Authorization: "Bearer " + admin.token },
        });
        expect(rsp).toHaveProperty("status");
        expect(rsp.status).toStrictEqual(204);

        try {
            await axios.get(`http://localhost:4201/news/${news.id}`);
        } catch (err) {
            expect(err).toHaveProperty("response");
            expect(err.response).toHaveProperty("status");
            expect(err.response.status).toStrictEqual(404);
            return;
        }
        return fail("get should have failed");
    });

    test("prevents anons from adding news", async () => {
        try {
            await axios.post("http://localhost:4201/news", {
                title: "news title",
                short: "check me out",
                news: "long news article",
            });
        } catch (err) {
            expect(err).toHaveProperty("response");
            expect(err.response).toHaveProperty("status");
            expect(err.response.status).toStrictEqual(401);
            return ok({});
        }
        return fail("post should have failed");
    });

    test("prevents users from adding news", async () => {
        const user = await createUser(false);
        try {
            await axios.post(
                "http://localhost:4201/news",
                {
                    title: "news title",
                    short: "check me out",
                    news: "long news article",
                },
                { headers: { Authorization: "Bearer " + user.token } },
            );
        } catch (err) {
            expect(err).toHaveProperty("response");
            expect(err.response).toHaveProperty("status");
            expect(err.response.status).toStrictEqual(403);
            return;
        }
        return fail("post should have failed");
    });

    test("returns a list of news for anons", async () => {
        await createNews();

        const rsp = await axios.get("http://localhost:4201/news");
        expectToContainAllKeys(rsp, ["status", "data"]);
        expect(rsp.status).toStrictEqual(200);
        expect(rsp.data).toBeInstanceOf(Array);
    });

    test("returns an article by id for anons", async () => {
        const article = await createNews();

        const rsp = await axios.get(`http://localhost:4201/news/${article.id}`);
        expectToContainAllKeys(rsp, ["status", "data"]);
        expect(rsp.status).toStrictEqual(200);
        expect(rsp.data).toHaveProperty("id");
        expect(rsp.data.id).toStrictEqual(article.id);
    });

    test("returns the single, latest article", async () => {
        await createNews();

        const rsp = await axios.get("http://localhost:4201/news", {
            params: { limit: 1, orderCol: "date_created", orderDir: "DESC" },
        });
        expectToContainAllKeys(rsp, ["status", "data"]);
        expect(rsp.status).toStrictEqual(200);
        expect(rsp.data).toBeInstanceOf(Array);
        expect(rsp.data.length).toStrictEqual(1);
    });
});
