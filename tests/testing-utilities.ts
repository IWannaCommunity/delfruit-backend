import axios from 'axios';
import { Database } from '../src/database';
import FormData from 'form-data';
import fs from 'fs';
import { Permission } from '../src/model/Permission';
import Config from '../src/model/config';
import { expect } from "@jest/globals";
let config: Config = require('../src/config/config.json');
var Moniker = require('moniker');

var gamenamegen = Moniker.generator([Moniker.adjective, Moniker.noun], { glue: ' ' });
var taggen = Moniker.generator([Moniker.adjective]);
var usergen = Moniker.generator(['src/int-test/usernames']);

export interface TestUser {
    token: string;
    id: number;
    username: string;
    password: string;
    email: string;
}

export function genUsername() {
    return usergen.choose() + '_' + Math.random().toString(36).substring(2, 6);
}

export function genGamename() {
    return gamenamegen.choose() + '_' + Math.random().toString(36).substring(2, 6);
}

export async function createUser(isAdmin: boolean): Promise<TestUser> {
    const usernameA = genUsername();

    //register
    const reg = await axios.post('http://localhost:4201/users',
        { username: usernameA, password: "test-pw", email: "test@example.com" });
    expect(reg).toHaveProperty("status")
    expect(reg.status).toStrictEqual(200);
    expect(reg).toHaveProperty('data');
    expect(reg.data).toHaveProperty('token')
    expect(reg.data.token).toEqual(expect.any(String));
    expect(reg.data).toHaveProperty('id');
    expect(reg.data.id).toEqual(expect.any(Number));

    if (isAdmin) {
        const db = new Database({
            host: 'localhost',
            port: 33061, //see docker-compose.yaml
            database: config.db.database,
            user: config.db.user,
            password: config.db.password,
        });
        try {
            const success = await db.execute('update User set is_admin = 1 WHERE id = ?', [reg.data.id]);
            expect(success.affectedRows).toEqual(1);
        } catch (err) {
            fail("failed to connect to database!\n" + err);
        } finally {
            try {
                await db.close();
            } catch (err) {
                fail("failed to close database!\n" + err);
            }
        }
    }

    //login
    const login = await axios.post('http://localhost:4201/auth/login',
        { username: usernameA, password: "test-pw" });
    expect(login).toHaveProperty('status');
    expect(login.status).toEqual(200);
    expect(login).toHaveProperty('data');
    expect(login.data).toHaveProperty('token');
    expect(login.data.token).toEqual(expect.any(String))

    return {
        token: login.data.token,
        id: login.data.id,
        username: usernameA,
        password: "test-pw",
        email: "test@example.com"
    };
}

export async function createGame(parameters?: any): Promise<any> {
    const user = await createUser(true);
    const name = gamenamegen.choose() + Math.random().toString(36).substring(2, 6);

    //create game
    const rsp = await axios.post('http://localhost:4201/games',
        {
            name: "i wanna be the " + name,
            author: user.username,
            ...parameters
        },
        { headers: { 'Authorization': "Bearer " + user.token } });
    expect(rsp).toHaveProperty('status')
    expect(rsp.status).toEqual(200);
    expect(rsp).toHaveProperty('data');
    expect(rsp.data).toHaveProperty('id')
    expect(rsp.data.id).toEqual(expect.any(Number));

    return { id: rsp.data.id, name: rsp.data.name, author: rsp.data.author, user };
}

export async function addScreenshot(user: TestUser, game: any): Promise<any> {
    let data = new FormData();

    data.append('description', 'super neat screenshot');
    data.append('screenshot', fs.createReadStream(__dirname + '/HYPE.png'));

    const hd = data.getHeaders();
    hd['Authorization'] = "Bearer " + user.token;

    const upd = await axios.post(`http://localhost:4201/games/${game.id}/screenshots`,
        data,
        { headers: hd });
    expect(upd).toHaveProperty('status')
    expect(upd.status).toEqual(200);
    expect(upd).toHaveProperty('data');
    expect(upd.data).toHaveProperty('id');
    expect(upd.data.id).toEqual(expect.any(Number));
    return upd.data;
}

export async function addReview(user: TestUser, game: any): Promise<any> {
    //review game
    const upd = await axios.put(`http://localhost:4201/games/${game.id}/reviews`,
        {
            rating: 69,
            difficulty: 50,
            comment: 'good game very good'
        },
        { headers: { 'Authorization': "Bearer " + user.token } });
    expect(upd).toHaveProperty('status');
    expect(upd.status).toEqual(200);
    expect(upd).toHaveProperty('data');
    expect(upd.data).toHaveProperty('id');
    expect(upd.data.id).toEqual(expect.any(Number));

    return upd.data;
}

export async function addTag(user: TestUser): Promise<any> {
    const nm = taggen.choose();

    const tres = await axios.post('http://localhost:4201/tags',
        { name: nm },
        { headers: { 'Authorization': "Bearer " + user.token } });
    expect(tres).toHaveProperty('status');
    expect(tres).toEqual(200);

    return tres.data;
}

export async function setUserToken(user: TestUser, token: string): Promise<any> {
    const database = new Database({
        host: 'localhost',
        port: 33061, //see docker-compose.yaml
        database: config.db.database,
        user: config.db.user,
        password: config.db.password,
    });
    try {
        const success = await database.execute(
            `UPDATE User SET reset_token = ?, reset_token_set_time = CURRENT_TIMESTAMP
            WHERE id = ?`, [token, user.id]);
        expect(success.affectedRows).toEqual(1);
    } catch (err) {
        console.log("failed to connecto to database!\n" + err);
        fail("failed to connecto to database!\n" + err);
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
        host: 'localhost',
        port: 33061, //see docker-compose.yaml
        database: config.db.database,
        user: config.db.user,
        password: config.db.password,
    });
    try {
        await database.execute(
            `INSERT IGNORE INTO UserPermission (user_id,permission_id) VALUES (?,?)`, [user.id, permission]);
    } catch (err) {
        console.log("failed to connecto to database!\n" + err);
        fail("failed to connecto to database!\n" + err);
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
        host: 'localhost',
        port: 33061, //see docker-compose.yaml
        database: config.db.database,
        user: config.db.user,
        password: config.db.password,
    });
    try {
        const result = await database.execute(
            `SELECT 1 FROM UserPermission WHERE user_id=? AND permission_id=?`, [user.id, permission]);
        return result.length === 1;
    } catch (err) {
        console.log("failed to connecto to database!\n" + err);
        fail("failed to connecto to database!\n" + err);
        return false;
    } finally {
        try {
            await database.close();
        } catch (err) {
            console.log("failed to close database!\n" + err);
        }
    }
}
