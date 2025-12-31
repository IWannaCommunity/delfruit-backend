import axios, { AxiosError, AxiosResponse } from "axios";
import { Database } from "../../src/database";
import FormData from "form-data";
import fs from "fs";
import { Permission } from "../../src/model/Permission";
import Config from "../../src/model/config";
import { expect } from "@jest/globals";
let config: Config = require("../../src/config/config.json");
var Moniker = require("moniker");

var gamenamegen = Moniker.generator([Moniker.adjective, Moniker.noun], {
    glue: " ",
});
var taggen = Moniker.generator([Moniker.adjective]);
var usergen = Moniker.generator(["./tests/integration/usernames"]);

export interface TestUser {
    token: string;
    id: number;
    username: string;
    password: string;
    email: string;
}

export function genUsername() {
    return usergen.choose() + "_" + Math.random().toString(36).substring(2, 6);
}

export function genGamename() {
    return gamenamegen.choose() + "_" + Math.random().toString(36).substring(2, 6);
}

export function assertAxiosRequest(req: AxiosResponse | any, statusCode: number): void | never {
    expect(req).toHaveProperty("status");
    expect(req.status).toStrictEqual(statusCode);
}

export function assertAxiosError(e: AxiosError | any, statusCode: number): void | never {
    expect(e).toHaveProperty("response");
    expect(e.response).toHaveProperty("status");
    expect(e.response.status).toStrictEqual(statusCode);
}

export function assertAxiosReqDataHasPropAndEquals(req: AxiosResponse, propName: string, value: any): void | never {
    expect(req.data).toHaveProperty(propName);
    expect(req.data[propName]).toEqual(value);
}

export function assertAxiosReqDataHasPropAndStrictEquals(
    req: AxiosResponse,
    propName: string,
    value: any,
): void | never {
    expect(req.data).toHaveProperty(propName);
    expect(req.data[propName]).toStrictEqual(value);
}

export async function createUser(isAdmin: boolean): Promise<TestUser> {
    const usernameA = genUsername();

    //register
    const reg = await axios.post("http://localhost:4201/users", {
        username: usernameA,
        password: "test-pw",
        email: "test@example.com",
    });
    assertAxiosRequest(reg, 201);
    expect(reg).toHaveProperty("data");
    expect(reg.data).toHaveProperty("token");
    expect(reg.data.token).toEqual(expect.any(String));

    if (isAdmin) {
        const db = new Database({
            host: config.db.host,
            port: 3306,
            database: config.db.database,
            user: config.db.user,
            password: config.db.password,
            connectTimeout: 5000,
        });
        try {
            const success = await db.execute("update User set is_admin = 1 WHERE name = ?", [usernameA]);
            expect(success.affectedRows).toEqual(1);
        } catch (err) {
            throw new Error("failed to connect to database!\n" + err);
        } finally {
            try {
                await db.close();
            } catch (err) {
                console.error(`failed to close database!\n ${err}`);
            }
        }
    }

    //login
    const login = await axios.post("http://localhost:4201/auth/login", {
        username: usernameA,
        password: "test-pw",
    });
    expect(login).toHaveProperty("status");
    expect(login.status).toEqual(200);
    expect(login).toHaveProperty("data");
    expect(login.data).toHaveProperty("token");
    expect(login.data.token).toEqual(expect.any(String));

    return {
        token: login.data.token,
        id: login.data.id,
        username: usernameA,
        password: "test-pw",
        email: "test@example.com",
    };
}

export async function createGame(parameters?: any): Promise<any> {
    const user = await createUser(true);
    const name = gamenamegen.choose() + Math.random().toString(36).substring(2, 6);

    //create game
    const rsp = await axios.post(
        "http://localhost:4201/games",
        {
            name: "i wanna be the " + name,
            author: [user.username],
			collab: false,
            ...parameters,
        },
        { headers: { Authorization: "Bearer " + user.token } },
    );
    expect(rsp).toHaveProperty("status");
    expect(rsp.status).toEqual(201);
    expect(rsp).toHaveProperty("data");
    expect(rsp.data).toHaveProperty("id");
    expect(rsp.data.id).toEqual(expect.any(Number));

    return {
        id: rsp.data.id,
        name: rsp.data.name,
        author: rsp.data.author,
        user,
    };
}

export async function addScreenshot(user: TestUser, game: any): Promise<any> {
    let data = new FormData();

    data.append("description", "super neat screenshot");
    data.append("screenshot", fs.createReadStream(__dirname + "/HYPE.png"));

    const hd = data.getHeaders();
    hd["Authorization"] = "Bearer " + user.token;

    const upd = await axios.post(`http://localhost:4201/games/${game.id}/screenshots`, data, { headers: hd });
    expect(upd).toHaveProperty("status");
    expect(upd.status).toEqual(200);
    expect(upd).toHaveProperty("data");
    expect(upd.data).toHaveProperty("id");
    expect(upd.data.id).toEqual(expect.any(Number));
    return upd.data;
}

export async function addReview(user: TestUser, game: any): Promise<any> {
    //review game
    const upd = await axios.put(
        `http://localhost:4201/games/${game.id}/reviews`,
        {
            rating: 69,
            difficulty: 50,
            comment: "good game very good",
        },
        { headers: { Authorization: "Bearer " + user.token } },
    );
    expect(upd).toHaveProperty("status");
    expect(upd.status).toEqual(200);
    expect(upd).toHaveProperty("data");
    expect(upd.data).toHaveProperty("id");
    expect(upd.data.id).toEqual(expect.any(Number));

    return upd.data;
}

export async function addTag(user: TestUser): Promise<any> {
    const nm = taggen.choose();

    const tres = await axios.post(
        "http://localhost:4201/tags",
        { name: nm },
        { headers: { Authorization: "Bearer " + user.token } },
    );
    expect(tres).toHaveProperty("status");
    expect(tres.status).toEqual(200);

    return tres.data;
}

export async function setUserToken(user: TestUser, token: string): Promise<any> {
    const database = new Database({
        host: config.db.host,
        port: 3306,
        database: config.db.database,
        user: config.db.user,
        password: config.db.password,
        connectTimeout: 1000,
    });
    try {
        const success = await database.execute(
            `UPDATE User SET reset_token = ?, reset_token_set_time = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [token, user.id],
        );
        expect(success.affectedRows).toEqual(1);
    } catch (err) {
        console.log("failed to connecto to database!\n" + err);
        throw new Error("failed to connecto to database!\n" + err);
    } finally {
        try {
            await database.close();
        } catch (err) {
            console.log("failed to close database!\n" + err);
        }
    }
}

export async function grantPermission(user: TestUser, permission: Permission): Promise<any> {
    const database = new Database({
        host: config.db.host,
        port: 3306,
        database: config.db.database,
        user: config.db.user,
        password: config.db.password,
        connectTimeout: 1000,
    });
    try {
        await database.execute(`INSERT IGNORE INTO UserPermission (user_id,permission_id) VALUES (?,?)`, [
            user.id,
            permission,
        ]);
    } catch (err) {
        console.log("failed to connecto to database!\n" + err);
        throw new Error("failed to connecto to database!\n" + err);
    } finally {
        try {
            await database.close();
        } catch (err) {
            console.log("failed to close database!\n" + err);
        }
    }
}

export async function hasPermission(user: TestUser, permission: Permission): Promise<boolean> {
    const database = new Database({
        host: config.db.host,
        port: 3306,
        database: config.db.database,
        user: config.db.user,
        password: config.db.password,
        connectTimeout: 1000,
    });
    try {
        const result = await database.execute(`SELECT 1 FROM UserPermission WHERE user_id=? AND permission_id=?`, [
            user.id,
            permission,
        ]);
        return result.length === 1;
    } catch (err) {
        console.log("failed to connecto to database!\n" + err);
        throw new Error("failed to connecto to database!\n" + err);
        return false;
    } finally {
        try {
            await database.close();
        } catch (err) {
            console.log("failed to close database!\n" + err);
        }
    }
}

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
