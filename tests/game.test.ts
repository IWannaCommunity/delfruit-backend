import axios from "axios";
import { test, describe, expect } from "@jest/globals";
import { assertAxiosError, assertAxiosRequest, createUser, createGame, addReview, addTag, genUsername, genGamename, grantPermission, assertAxiosReqDataHasPropAndEquals, assertAxiosReqDataHasPropAndStrictEquals } from "./testing-utilities";
import FormData from 'form-data';
import fs from 'fs';
import { Permission } from '../src/model/Permission';
var Moniker = require('moniker');

var gamenamegen = Moniker.generator([Moniker.adjective, Moniker.noun], { glue: ' ' });
var taggen = Moniker.generator([Moniker.adjective]);

describe("game controller", () => {
    test("allows admins to add a game", async () => {
        const user = await createUser(true);

        const rsp = await axios.post("http://localhost:4201/games", { name: "i wanna " + user.username, url: "example.com/" + user.username, author: user.username }, { headers: { "Authorization": "Bearer " + user.token } });

        assertAxiosRequest(rsp, 201);

        expect(rsp).toHaveProperty("data");

        assertAxiosReqDataHasPropAndEquals(rsp, "name", "i wanna " + user.username);
        assertAxiosReqDataHasPropAndEquals(rsp, "sortname", user.username);
        assertAxiosReqDataHasPropAndEquals(rsp, "url", "example.com/" + user.username);
        assertAxiosReqDataHasPropAndStrictEquals(rsp, "author", [user.username]);
        assertAxiosReqDataHasPropAndEquals(rsp, "adder_id", user.id);
    });

    test("returns games for anonymous users", async () => {
        const game = await createGame();

        const del = await axios.get(`http://localhost:4201/games/${game.id}`);

        assertAxiosRequest(del, 200);
        expect(del).toHaveProperty("data");

        assertAxiosReqDataHasPropAndEquals(del, "name", game.name);
    });

    test("prevents anonymous users from adding games", async () => {
        const gn = genGamename();

        try {
            await axios.post("http://localhost:4201/games", { name: "i wanna " + gn, url: "example.com/" + gn, author: genUsername() });
        } catch (e) {
            return assertAxiosError(e, 401);
        }

        fail("game submission should not have been successful");
    });

    test("allows admins to delete a game", async () => {
        const user = await createUser(true);
        const name = genGamename();

        // we need a game to delete first!
        const rsp = await axios.post("http://localhost:4201/games", { name: "i wanna be the " + name, url: "example.com/" + name, author: user.username }, { headers: { "Authorization": "Bearer " + user.token } });
        assertAxiosRequest(rsp, 201);

        expect(rsp).toHaveProperty("data");
        assertAxiosReqDataHasPropAndEquals(rsp, "id", expect.any(Number));

        // delete game
        const del = await axios.delete(`http://localhost:4201/games/${rsp.data.id}`, { headers: { "Authorization": "Bearer " + user.token } });
        assertAxiosRequest(del, 204);
    });

    test("prevents anonymous users from deleting games", async () => {
        const game = await createGame();

        try {
            await axios.delete(`http://localhost:4201/games/${game.id}`);
        } catch (e) {
            assertAxiosError(e, 401);
            return;
        }
        fail("game deletion should not have been successful");
    });

    test("allows admins to modify a game", async () => {
        const user = await createUser(true);

        const rsp = await axios.post('http://localhost:4201/games',
            {
                name: "i wanna " + user.username,
                url: "example.com/" + user.username,
                author: user.username
            },
            { headers: { 'Authorization': "Bearer " + user.token } });

        assertAxiosRequest(rsp, 201);
        expect(rsp).toHaveProperty("data");
        assertAxiosReqDataHasPropAndEquals(rsp, "id", expect.any(Number));

        const upd = await axios.patch(`http://localhost:4201/games/${rsp.data.id}`,
            { name: "totally different name " + user.username },
            { headers: { 'Authorization': "Bearer " + user.token } });

        assertAxiosRequest(upd, 200)
        expect(upd).toHaveProperty("data");
        assertAxiosReqDataHasPropAndEquals(upd, "id", rsp.data.id);
        assertAxiosReqDataHasPropAndEquals(upd, "name", "totally different name " + user.username);
    });

    test("prevents regular users from modifying a game", async () => {
        const user = await createUser(false);
        const game = await createGame();

        try {
            await axios.patch(`http://localhost:4201/games/${game.id}`,
                { name: "totally different name " + user.username },
                { headers: { 'Authorization': "Bearer " + user.token } });
        } catch (e) {
            assertAxiosError(e, 403);
            return;
        }
        fail("game edit should not have been successful");
    });

    test("returns 404 when retrieving tags for a non-existent game", async () => {
        const admin = await createUser(true);
        const user = await createUser(false);
        const game = await createGame();

        await axios.delete(`http://localhost:4201/games/${game.id}`,
            { headers: { 'Authorization': "Bearer " + admin.token } });

        try {
            await axios.get(`http://localhost:4201/games/${game.id}/tags`,
                { headers: { 'Authorization': "Bearer " + user.token } });
        } catch (e) {
            assertAxiosError(e, 404);
            return;
        }
        fail("game retrieval should not have been successful");
    });

    test("fails when adding malformed tags", async () => {
        const user = await createUser(false);
        const game = await createGame();
        try {
            await axios.post(`http://localhost:4201/games/${game.id}/tags`,
                ["reeee"],
                { headers: { 'Authorization': "Bearer " + user.token } });
        } catch (e) {
            assertAxiosError(e, 400);
            return;
        }
        fail("game submission with bad tags should not have been successful");
    });

    test("allows setting tags on a game", async () => {
        const user = await createUser(false);
        const game = await createGame();

        const tag = await addTag(user);

        const res = await axios.post(`http://localhost:4201/games/${game.id}/tags`,
            [tag.id],
            { headers: { 'Authorization': "Bearer " + user.token } }
		);

        assertAxiosRequest(res, 200);
        expect(res).toHaveProperty('data');
        expect(res.data).toEqual(expect.any(Array));
        expect(res.data[0].name).toEqual(tag.name);
        expect(res.data[0].id).toEqual(tag.id);
    });

    test("allows user to clear tags", async () => {
        const user = await createUser(false);
        const game = await createGame();

        const nm = taggen.choose();

        const tres = await axios.post('http://localhost:4201/tags',
            { name: nm },
            { headers: { 'Authorization': "Bearer " + user.token } });

        assertAxiosRequest(tres, 200);
        expect(tres).toHaveProperty("data");
        const tid = tres.data.id;

        const res = await axios.post(`http://localhost:4201/games/${game.id}/tags`,
            [tid],
            { headers: { 'Authorization': "Bearer " + user.token } });
        assertAxiosRequest(res, 200);
        expect(res).toHaveProperty("data");
        expect(res.data[0].id).toEqual(tid);

        const res2 = await axios.post(`http://localhost:4201/games/${game.id}/tags`,
            [],
            { headers: { 'Authorization': "Bearer " + user.token } });
        assertAxiosRequest(res2, 200);
        expect(res2).toHaveProperty("data");
        expect(res2.data.length).toEqual(0);
    });

    test("prevents adding nonexistent tags to a game", async () => {
        const user = await createUser(false);
        const game = await createGame();

        try {
            await axios.post(`http://localhost:4201/games/${game.id}/tags`,
                [-1, -2, -3],
                { headers: { 'Authorization': "Bearer " + user.token } });
        } catch (e) {
            assertAxiosError(e, 400);
            return;
        }
        fail("tags added to game when it should have not been successful");
    });

    test("allows user to review the game", async () => {
        const user = await createUser(false);
        const game = await createGame();

        const upd = await axios.put(`http://localhost:4201/games/${game.id}/reviews`,
            {
                rating: 69,
                difficulty: 50,
                comment: 'good game very good'
            },
            { headers: { 'Authorization': "Bearer " + user.token } });

        assertAxiosRequest(upd, 200);
        expect(upd).toHaveProperty("data");
        assertAxiosReqDataHasPropAndEquals(upd, "id", expect.any(Number));
        assertAxiosReqDataHasPropAndEquals(upd, "rating", 69);
        assertAxiosReqDataHasPropAndEquals(upd, "difficulty", 50);
        assertAxiosReqDataHasPropAndEquals(upd, "comment", "good game very good");
    });

    test("allows users to review the game idempotently", async () => {
        const user = await createUser(false);
        const game = await createGame();

        const upd = await axios.put(`http://localhost:4201/games/${game.id}/reviews`,
            {
                rating: 69,
                difficulty: 50,
                comment: 'good game very good'
            },
            { headers: { 'Authorization': "Bearer " + user.token } });

        assertAxiosRequest(upd, 200);
        expect(upd).toHaveProperty("data");
        assertAxiosReqDataHasPropAndEquals(upd, "id", expect.any(Number));
        assertAxiosReqDataHasPropAndEquals(upd, "rating", 69);
        assertAxiosReqDataHasPropAndEquals(upd, "difficulty", 50);
        assertAxiosReqDataHasPropAndEquals(upd, "comment", "good game very good");

        const upd2 = await axios.put(`http://localhost:4201/games/${game.id}/reviews`,
            {
                rating: 69,
                difficulty: 50,
                comment: 'good game very good'
            },
            { headers: { 'Authorization': "Bearer " + user.token } });

        assertAxiosRequest(upd2, 200);
        expect(upd2).toHaveProperty("data");
        assertAxiosReqDataHasPropAndEquals(upd2, "id", expect.any(Number));
        assertAxiosReqDataHasPropAndEquals(upd2, "rating", 69);
        assertAxiosReqDataHasPropAndEquals(upd2, "difficulty", 50);
        assertAxiosReqDataHasPropAndEquals(upd2, "comment", "good game very good");
    });

    test("returns reviews for a game", async () => {
        const user = await createUser(false);
        const game = await createGame();

        const upd = await axios.put(`http://localhost:4201/games/${game.id}/reviews`,
            {
                rating: 69,
                difficulty: 50,
                comment: 'good game very good'
            },
            { headers: { 'Authorization': "Bearer " + user.token } });
        assertAxiosRequest(upd, 200);

        const reviews = await axios.get(`http://localhost:4201/games/${game.id}/reviews`);
        assertAxiosRequest(reviews, 200);
        expect(reviews).toHaveProperty("data");
        expect(reviews.data).toEqual(expect.any(Array));
        expect(reviews.data.length).toEqual(1);
    });

    test("allows users to add a screenshot to the game", async () => {
        const user = await createUser(false);
        const game = await createGame();

        let data = new FormData();

        data.append('description', 'super neat screenshot');
        data.append('screenshot', fs.createReadStream(__dirname + '/HYPE.png'));

        const hd = data.getHeaders();
        hd["Authorization"] = "Bearer " + user.token;

        const upd = await axios.post(`http://localhost:4201/games/${game.id}/screenshots`,
            data,
            { headers: hd });

        assertAxiosRequest(upd, 200);
        expect(upd).toHaveProperty("data");
        assertAxiosReqDataHasPropAndEquals(upd, "id", expect.any(Number));
        assertAxiosReqDataHasPropAndEquals(upd, "description", "super neat screenshot");
        assertAxiosReqDataHasPropAndEquals(upd, "gameId", game.id);
        assertAxiosReqDataHasPropAndEquals(upd, "approved", null);
    });

    test("auto-approves a screenshot if the user has the permission", async () => {
        const user = await createUser(false);
        const game = await createGame();
        await grantPermission(user, Permission.AUTO_APPROVE_SCREENSHOT);

        let data = new FormData();

        data.append('description', 'super neat screenshot');
        data.append('screenshot', fs.createReadStream(__dirname + '/HYPE.png'));

        const hd = data.getHeaders();
        hd["Authorization"] = "Bearer " + user.token;

        const upd = await axios.post(`http://localhost:4201/games/${game.id}/screenshots`,
            data,
            { headers: hd });

        assertAxiosRequest(upd, 200);
        expect(upd).toHaveProperty("data");
        assertAxiosReqDataHasPropAndEquals(upd, "id", expect.any(Number));
        assertAxiosReqDataHasPropAndEquals(upd, "description", "super neat screenshot");
        assertAxiosReqDataHasPropAndEquals(upd, "gameId", game.id);
        assertAxiosReqDataHasPropAndEquals(upd, "approved", true);

    });

    test("supports id search", async () => {
        const game = await createGame();

        const list = await axios.get(`http://localhost:4201/games`, {
            params: { id: game.id } //name contains username
        });

        assertAxiosRequest(list, 200);
        expect(list).toHaveProperty("data");
        expect(list.data).toEqual(expect.any(Array));
        const games = list.data as any[];
        return expect(games.find(o => o.id == game.id)).toBeDefined();
    });

    test("supports name search", async () => {
        const game = await createGame();

        const list = await axios.get(`http://localhost:4201/games`, {
            params: { name: game.name } //name contains username
        });

        assertAxiosRequest(list, 200);
        expect(list).toHaveProperty("data");
        expect(list.data).toEqual(expect.any(Array));
        const games = list.data as any[];
        return expect(games.find(o => o.id == game.id)).toBeDefined();
    });

    test("supports author search", async () => {
        const game = await createGame();

        var list = await axios.get(`http://localhost:4201/games`, {
           params: { author: game.author[0] } // QUEST: how should we be using the array here? author_raw is also always empty...
        });

        assertAxiosRequest(list, 200);
        expect(list).toHaveProperty("data");
        expect(list.data).toEqual(expect.any(Array));
        const games = list.data as any[];
        return expect(games.find(o => o.id == game.id)).toBeDefined();
    });

    test("does not return games with the wrong author for author search", async () => {
        const game = await createGame();

        const list = await axios.get(`http://localhost:4201/games`, {
            params: { id: game.id, author: 'this is not the author' }
        });

        assertAxiosRequest(list, 200);
        expect(list).toHaveProperty("data");
        expect(list.data).toEqual(expect.any(Array));
        const games = list.data as any[];
        return expect(games.find(o => o.id == game.id)).toBeUndefined();
    });

    test("supports has-download search", async () => {
        const game = await createGame({ url: "example.com" });

        const list = await axios.get(`http://localhost:4201/games`, {
            params: { id: game.id, hasDownload: true }
        });

        assertAxiosRequest(list, 200);
        expect(list).toHaveProperty("data");
        expect(list.data).toEqual(expect.any(Array));
        const games = list.data as any[];
        return expect(games.find(o => o.id == game.id)).toBeDefined();
    });

    test("does not return games without download for has-download search", async () => {
        const game = await createGame();

        const list = await axios.get(`http://localhost:4201/games`, {
            params: { id: game.id, hasDownload: true }
        });

        assertAxiosRequest(list, 200);
        expect(list).toHaveProperty("data");
        expect(list.data).toEqual(expect.any(Array));
        const games = list.data as any[];
        return expect(games.find(o => o.id == game.id)).toBeUndefined();
    });

    test("supports rating-from search", async () => {
        const game = await createGame();
        const user = await createUser(false);
        await addReview(user, game);

        const list = await axios.get(`http://localhost:4201/games`, {
            params: { id: game.id, ratingFrom: 60 }
        });

        assertAxiosRequest(list, 200);
        expect(list).toHaveProperty("data");
        expect(list.data).toEqual(expect.any(Array));
        const games = list.data as any[];
        return expect(games.find(o => o.id == game.id)).toBeDefined();
    });

    test("supports rating-to search", async () => {
        const game = await createGame();
        const user = await createUser(false);
        await addReview(user, game)

        const list = await axios.get(`http://localhost:4201/games`, {
            params: { id: game.id, ratingTo: 70 }
        });

        assertAxiosRequest(list, 200);
        expect(list).toHaveProperty("data");
        expect(list.data).toEqual(expect.any(Array));
        const games = list.data as any[];
        return expect(games.find(o => o.id == game.id)).toBeDefined();
    });

    test("supports rating range search", async () => {
        const game = await createGame();
        const user = await createUser(false);
        await addReview(user, game);

        const list = await axios.get(`http://localhost:4201/games`, {
            params: { id: game.id, ratingFrom: 60, ratingTo: 70 }
        });

        assertAxiosRequest(list, 200);
        expect(list).toHaveProperty("data");
        expect(list.data).toEqual(expect.any(Array));
        const games = list.data as any[];
        return expect(games.find(o => o.id == game.id)).toBeDefined();
    });

    test("does not return games outside range for rating range search", async () => {
        const game = await createGame();

        const list = await axios.get(`http://localhost:4201/games`, {
            params: { id: game.id, ratingFrom: 50, ratingTo: 60 }
        });

        assertAxiosRequest(list, 200);
        expect(list).toHaveProperty("data");
        expect(list.data).toEqual(expect.any(Array));
        const games = list.data as any[];
        return expect(games.find(o => o.id == game.id)).toBeUndefined();
    });

    test("supports difficulty-from search", async () => {
        const game = await createGame();
        const user = await createUser(false);
        await addReview(user, game)

        const list = await axios.get(`http://localhost:4201/games`, {
            params: { id: game.id, difficultyFrom: 40 }
        });

        assertAxiosRequest(list, 200);
        expect(list).toHaveProperty("data");
        expect(list.data).toEqual(expect.any(Array));
        const games = list.data as any[];
        return expect(games.find(o => o.id == game.id)).toBeDefined();
    });

    test("supports difficulty-to search", async () => {
        const game = await createGame();
        const user = await createUser(false);
        await addReview(user, game)

        const list = await axios.get(`http://localhost:4201/games`, {
            params: { id: game.id, difficultyTo: 60 }
        });

        assertAxiosRequest(list, 200);
        expect(list).toHaveProperty("data");
        expect(list.data).toEqual(expect.any(Array));
        const games = list.data as any[];
        return expect(games.find(o => o.id == game.id)).toBeDefined();
    });

    test("supports difficulty range search", async () => {
        const game = await createGame();
        const user = await createUser(false);
        await addReview(user, game)

        const list = await axios.get(`http://localhost:4201/games`, {
            params: { id: game.id, difficultyFrom: 40, difficultyTo: 60 }
        });

        assertAxiosRequest(list, 200);
        expect(list).toHaveProperty("data");
        expect(list.data).toEqual(expect.any(Array));
        const games = list.data as any[];
        return expect(games.find(o => o.id == game.id)).toBeDefined();
    });

    test("does not return games outside range for difficulty range search", async () => {
        const game = await createGame();

        const list = await axios.get(`http://localhost:4201/games`, {
            params: { id: game.id, difficultyFrom: 10, difficultyTo: 20 }
        });

        assertAxiosRequest(list, 200);
        expect(list).toHaveProperty("data");
        expect(list.data).toEqual(expect.any(Array));
        const games = list.data as any[];
        return expect(games.find(o => o.id == game.id)).toBeUndefined();
    });

    test("returns the total count of matched games in header", async () => {
        const game = await createGame();

        const list = await axios.get(`http://localhost:4201/games`, {
            params: { name: game.name } //name contains username
        });

        assertAxiosRequest(list, 200);
        expect(list.headers).toHaveProperty("total-count");
        expect(list.headers["total-count"]).toEqual("1");
    });

    test("returns 0 for the total count of matched games in header when no match", async () => {
        const game = await createGame();

        const list = await axios.get(`http://localhost:4201/games`, {
            params: { name: game.name } //name contains username
        });

        assertAxiosRequest(list, 200);
        expect(list.headers).toHaveProperty("total-count");
        expect(list.headers["total-count"]).toEqual("0");
    });
});
