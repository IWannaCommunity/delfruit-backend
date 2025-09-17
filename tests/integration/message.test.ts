import { test, describe, expect } from "@jest/globals";
import axios from "axios";
import { createUser, expectToContainAllKeys } from "./testing-utilities";

describe("message endpoint", function () {
    test("allows the user to send a new message", async () => {
        const sender = await createUser(false);
        const recipient = await createUser(false);

        //send
        const rsp = await axios.post(
            "http://localhost:4201/message",
            {
                userToId: recipient.id,
                subject: "neat message",
                body: "wow this is neat",
            },
            { headers: { Authorization: "Bearer " + sender.token } },
        );
        expect(rsp).toHaveProperty("status");
        expect(rsp.status).toStrictEqual(201);
    });

    test("allows the user to send a new message and the recipient to read it", async () => {
        const sender = await createUser(false);
        const recipient = await createUser(false);

        //send
        const rsp = await axios.post(
            "http://localhost:4201/message",
            {
                userToId: recipient.id,
                subject: "neat message",
                body: "wow this is neat",
            },
            { headers: { Authorization: "Bearer " + sender.token } },
        );
        expect(rsp).toHaveProperty("status");
        expect(rsp.status).toStrictEqual(201);

        //check receipt
        const rcpt = await axios.get("http://localhost:4201/message/inbox", {
            headers: { Authorization: "Bearer " + recipient.token },
        });
        expectToContainAllKeys(rcpt, ["status", "data"]);
        expect(rcpt.status).toStrictEqual(200);
        expect(rcpt.data).toBeInstanceOf(Array);
        expect(rcpt.data.length).toBeGreaterThan(0);
        expectToContainAllKeys(rcpt.data[0], ["subject", "body"]);
        expect(rcpt.data[0].subject).toStrictEqual("neat message");
        expect(rcpt.data[0].body).toStrictEqual("wow this is neat");
    });

    test.skip("creates a thread when a user replies", async () => {
        const sender = await createUser(false);
        const recipient = await createUser(false);

        //send
        const msg = await axios.post(
            "http://localhost:4201/message",
            {
                userToId: recipient.id,
                subject: "neat message",
                body: "wow this is neat",
            },
            { headers: { Authorization: "Bearer " + sender.token } },
        );
        expect(msg).toHaveProperty("status");
        expect(msg.status).toStrictEqual(201);

        //check receipt
        const rcpt = await axios.get("http://localhost:4201/message/inbox", {
            headers: { Authorization: "Bearer " + recipient.token },
        });
        expectToContainAllKeys(rcpt, ["status", "data"]);
        expect(rcpt.status).toStrictEqual(200);
        expect(rcpt.data).toBeInstanceOf(Array);
        expect(rcpt.data.length).toBeGreaterThan(0);
        expect(rcpt.data[0]).toHaveProperty("id");
        expect(typeof rcpt.data[0].id).toStrictEqual("number");

        //reply
        const rply = await axios.post(
            "http://localhost:4201/message",
            {
                userToId: sender.id,
                subject: "my reply",
                body: "yes, totally neat",
                replyToId: rcpt.data[0].id,
            },
            { headers: { Authorization: "Bearer " + recipient.token } },
        );
        expect(rply).toHaveProperty("status");
        expect(rply.status).toStrictEqual(204);

        //check receipt
        const rcpt2 = await axios.get("http://localhost:4201/message/inbox", {
            headers: { Authorization: "Bearer " + sender.token },
        });
        expectToContainAllKeys(rcpt2, ["status", "data"]);
        expect(rcpt2.status).toStrictEqual(200);
        expect(rcpt.data).toBeInstanceOf(Array);
        expect(rcpt.data.length).toBeGreaterThan(0);
        expect(rcpt2.data[0]).toHaveProperty("threadId");
        expect(rcpt2.data[0].threadId).toStrictEqual(rcpt.data[0].id);
    });
});
