//  * Black-box HTTP tests for Create Bet. Each request goes through the real path:
//  *   express.json() -> betRoutes -> authMiddleware -> requireVerifiedEmail -> betController -> betService
//  *

const {FieldValue} = require("firebase-admin/firestore");

const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn();

const mockParticipantRef = { path: "bets/generated-bet-id/participants/token-uid" };
const mockBetRef = {
    id: "generated-bet-id",
    collection: () => ({doc: () => mockParticipantRef}),
    // returns whatever the service wrote to the Bet document
    get: async () => ({
        data: () => mockBatchSet.mock.calls.find(([ref]) => ref === mockBetRef)?.[1],
    }),
};

jest.mock("../../src/config/firebaseAdmin", () => ({
    auth: {
        verifyIdToken: jest.fn(),
    },
    db: {
        collection: () => ({doc: () => mockBetRef}),
        batch: () => ({ set: mockBatchSet, commit: mockBatchCommit}),
    },
}));

const request = require("supertest");
const app = require("../../src/app");
const {auth} = require("../../src/config/firebaseAdmin");

const TOKEN_UID = "token-uid";
const DAY_MS = 24*60*60*1000;

const deadline = new Date(Date.now() + 7 * DAY_MS);
const outcomeDeadline = new Date(deadline.getTime() + DAY_MS);

function validMonetaryBody(overrides = {}) {
    return {
        title: "Will the Dodgers win on Friday?",
        description: "Friendly wager on Friday's game.",
        outcomeA: "Dodgers win",
        outcomeB: "Dodgers lose",
        deadline: deadline.toISOString(),
        outcomeDeadline: outcomeDeadline.toISOString(),
        visibility: "public",
        resolutionMethod: "external",
        stakeType: "monetary",
        stakeAmountCents: 1000,
        currency: "USD",
        creatorSide: "A",
        termsAcknowledged: true,
        ...overrides,
    };
}

function validNonMonetaryBody(overrides={}) {
    const body = validMonetaryBody({
        stakeType: "nonMonetary",
        stakeDescription: "Loser buys coffee",
        ...overrides,
    });
    delete body.stakeAmountCents;
    delete body.currency;
    return body;
}

// removes a field entirely 
function without(body,field) {
    const copy = {...body};
    delete copy[field];
    return copy;
}

function postBet(body) {
    return request(app)
        .post("/api/bets")
        .set("Authorization", "Bearer valid-token")
        .send(body);
}

function dataWrittenTo(ref) {
    return mockBatchSet.mock.calls.find(([writtenRef]) => writtenRef === ref)?.[1];
}

// shared checks for every 400 response
function expectBadRequest(res, messagePattern) {
    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body).toEqual({error: "invalid_request", message: expect.any(String)});
    if (messagePattern) {
        expect(res.body.message).toMatch(messagePattern);
    }
    // invalid requests must never reach Firestore.
    expect(mockBatchSet).not.toHaveBeenCalled();
    expect(mockBatchCommit).not.toHaveBeenCalled();
}

describe("POST /api/bets (Create Bet Integration)", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        auth.verifyIdToken.mockResolvedValue({uid: TOKEN_UID, email_verified: true});
        mockBatchCommit.mockResolvedValue(undefined);
    });

    describe("authentication (401)", () => {
        it("returns 401 when the Authorization header is missing", async () => {
            const res = await request(app).post("/api/bets").send(validMonetaryBody());
            expect(res.status).toBe(401);
            expect(res.body).toEqual({error: "unauthorized", message: expect.any(String)});
            expect(auth.verifyIdToken).not.toHaveBeenCalled();
            expect(mockBatchCommit).not.toHaveBeenCalled();
        });

        it("returns 401 when the header is not in \"Bearer <token>\" format", async () => {
            const res = await request(app)
                .post("/api/bets")
                .set("Authorization", "Token valid-token")
                .send(validMonetaryBody());

            expect(res.status).toBe(401);
            expect(res.body).toEqual({error: "unauthorized", message: expect.any(String)});
            expect(mockBatchCommit).not.toHaveBeenCalled();
        });

        it("returns 401 when Firebase rejects the token", async () => {
            auth.verifyIdToken.mockRejectedValue(new Error("auth/id-token-expired"));
            const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            const res = await postBet(validMonetaryBody());

            expect(res.status).toBe(401);
            expect(res.body).toEqual({error: "unauthorized", message: expect.any(String)});
            expect(mockBatchCommit).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe("email verification (403)", () => {
        it.each([
            ["email_verified is false", { uid: TOKEN_UID, email_verified: false}],
            ["email_verified is missing", { uid: TOKEN_UID}],
            ["email_verified is the string \"true\"", {uid: TOKEN_UID, email_verified: "true"}],

        ])("returns 403 when %s", async(_label, decodedToken) => {
            auth.verifyIdToken.mockResolvedValue(decodedToken);
            const res = await postBet(validMonetaryBody());

            expect(res.status).toBe(403);
            expect(res.body).toEqual({error: "email_not_verified", message: expect.any(String)});
            expect(mockBatchCommit).not.toHaveBeenCalled();
        });

        it("checks authentication before verification (no token gives 401, not 403)", async () => {
            const res = await request(app).post("/api/bets").send(validMonetaryBody());
            expect(res.status).toBe(401);
        });


    });

    describe("valid requests (201)", () => {
        it("creates a valid monetary Bet for a verified user", async () => {
            const res = await postBet(validMonetaryBody());
            expect(res.status).toBe(201);
            expect(res.body.message).toBe("Bet created successfully.");
            expect(res.body.bet).toMatchObject({
                id: "generated-bet-id",
                title: "Will the Dodgers win on Friday?",
                outcomeA: "Dodgers win",
                outcomeB: "Dodgers lose",
                creatorUid: TOKEN_UID,
                creatorSide: "A",
                status: "draft",
                stakeType: "monetary",
                stakeAmountCents: 1000,
                currency: "USD",
                participantCount: 1,
            });
            expect(mockBatchCommit).toHaveBeenCalledTimes(1);
        });

        it("creates a valid non-monetary Bet and does not store monetary fields", async () => {
            const res = await postBet(validNonMonetaryBody({
                stakeAmountCents: 5000,
                currency: "USD",
            }));

            expect(res.status).toBe(201);
            const written=dataWrittenTo(mockBetRef);
            expect(written.stakeType).toBe("nonMonetary");
            expect(written.stakeDescription).toBe("Loser buys coffee");
            expect(written).not.toHaveProperty("stakeAmountCents");
            expect(written).not.toHaveProperty("currency");
        });

        it("creates a valid monetary Bet and does not store a stakeDescription", async () => {
            const res = await postBet(validMonetaryBody({
                stakeDescription: "Should be ignored",
            }));

            expect(res.status).toBe(201);
            const written = dataWrittenTo(mockBetRef);
            expect(written.stakeType).toBe("monetary");
            expect(written.stakeAmountCents).toBe(1000);
            expect(written).not.toHaveProperty("stakeDescription");
        });

        it("trims whitespace from text fields before saving", async () => {
            const res = await postBet(validMonetaryBody({
                title: "  Padded title  ",
                outcomeA: "  Yes  ",
                outcomeB: "  No  ",
                currency: "  USD  ",
            }));

            expect(res.status).toBe(201);
            const written = dataWrittenTo(mockBetRef);
            expect(written.title).toBe("Padded title");
            expect(written.outcomeA).toBe("Yes");
            expect(written.outcomeB).toBe("No");
            expect(written.currency).toBe("USD");
        });

        it.each([
            ["a 1-character title", { title: "T" }],
            ["the minimum stake of 1 cent", { stakeAmountCents: 1 }],
            ["outcomes that differ by one character", { outcomeA: "Yes", outcomeB: "Yes!" }],
            ["creatorSide \"B\"", { creatorSide: "B" }],
            ["private visibility", { visibility: "private" }],
            ["personal resolution method", { resolutionMethod: "personal" }],
            ["a deadline one minute in the future", {
                deadline: new Date(Date.now() + 60 * 1000).toISOString(),
            }],
            ["an outcome deadline 1 ms after the deadline", {
                outcomeDeadline: new Date(deadline.getTime() + 1).toISOString(),
            }],
        ])("accepts %s (valid boundary)", async (_label, overrides) => {
            const res = await postBet(validMonetaryBody(overrides));

            expect(res.status).toBe(201);
        });

        it("records the side counts for the creator's chosen side", async () => {
            const res = await postBet(validMonetaryBody({creatorSide: "B"}));

            expect(res.status).toBe(201);
            const written = dataWrittenTo(mockBetRef);
            expect(written.sideACount).toBe(0);
            expect(written.sideBCount).toBe(1);
        });
    });

    describe("missing or blank required fields (400)", () => {
        const requiredFields = [
            "title",
            "description",
            "outcomeA",
            "outcomeB",
            "visibility",
            "resolutionMethod",
            "deadline",
            "outcomeDeadline",
            "stakeType",
            "creatorSide",
            "termsAcknowledged",
        ];

        it.each(requiredFields)("returns 400 when %s is missing", async (field) => {
            const res = await postBet(without(validMonetaryBody(), field));

            expectBadRequest(res, new RegExp(field));
        });

        it.each(["title", "description", "outcomeA", "outcomeB"])(
            "returns 400 when %s is an empty string",
            async (field) => {
                const res = await postBet(validMonetaryBody({ [field]: "" }));

                expectBadRequest(res, new RegExp(field));
            }
        );

        it.each(["title", "description", "outcomeA", "outcomeB"])(
            "returns 400 when %s is only whitespace",
            async (field) => {
                const res = await postBet(validMonetaryBody({ [field]: "   " }));

                expectBadRequest(res, new RegExp(field));
            }
        );

        it.each(["title", "description", "outcomeA", "outcomeB"])(
            "returns 400 when %s is not a string",
            async (field) => {
                const res = await postBet(validMonetaryBody({ [field]: 123 }));

                expectBadRequest(res, new RegExp(field));
            }
        );

        it("returns 400 for an empty JSON body", async () => {
            const res = await postBet({});

            expectBadRequest(res);
        });
    });

    describe("duplicate outcomes (400)", () => {
        it.each([
            ["identical", "Yes", "Yes"],
            ["different case", "Yes", "yes"],
            ["extra whitespace", " Yes ", "Yes"],
            ["whitespace and case together", "  YES", "yes  "],
        ])("returns 400 when outcomes match after normalization (%s)", async (_label, a, b) => {
            const res = await postBet(validMonetaryBody({ outcomeA: a, outcomeB: b }));

            expectBadRequest(res, /must be different/);
        });
    });

    describe("invalid enum values (400)", () => {
        it.each([
            ["visibility", "friends"],
            ["visibility", "Public"],
            ["visibility", ""],
            ["resolutionMethod", "vote"],
            ["resolutionMethod", "External"],
            ["creatorSide", "C"],
            ["creatorSide", "a"],
            ["creatorSide", 1],
            ["stakeType", "cash"],
            ["stakeType", "non_monetary"],
        ])("returns 400 when %s is %p", async (field, value) => {
            const res = await postBet(validMonetaryBody({ [field]: value }));

            expectBadRequest(res, new RegExp(field));
        });
    });

    describe("terms acknowledgment (400)", () => {
        it.each([
            ["false", false],
            ["the string \"true\"", "true"],
            ["the number 1", 1],
            ["null", null],
        ])("returns 400 when termsAcknowledged is %s", async (_label, value) => {
            const res = await postBet(validMonetaryBody({ termsAcknowledged: value }));

            expectBadRequest(res, /termsAcknowledged/);
        });
    });

    describe("participation deadline (400)", () => {
        it.each([
            ["not a date", "not-a-date"],
            ["blank", "   "],
            ["a number instead of a string", 1893456000000],
            ["one second in the past", new Date(Date.now() - 1000).toISOString()],
            ["one day in the past", new Date(Date.now() - DAY_MS).toISOString()],
        ])("returns 400 when deadline is %s", async (_label, value) => {
            const res = await postBet(validMonetaryBody({ deadline: value }));

            expectBadRequest(res, /deadline/);
        });
    });

    describe("outcome deadline (400)", () => {
        it.each([
            ["equal to the deadline", deadline.toISOString()],
            ["1 ms before the deadline", new Date(deadline.getTime() - 1).toISOString()],
            ["one day before the deadline", new Date(deadline.getTime() - DAY_MS).toISOString()],
        ])("returns 400 when outcomeDeadline is %s", async (_label, value) => {
            const res = await postBet(validMonetaryBody({ outcomeDeadline: value }));

            expectBadRequest(res, /outcomeDeadline must be after deadline/);
        });

        it("returns 400 when outcomeDeadline is not a valid date", async () => {
            const res = await postBet(validMonetaryBody({ outcomeDeadline: "tomorrow-ish" }));

            expectBadRequest(res, /outcomeDeadline must be a valid date/);
        });
    });

    describe("monetary stake (400)", () => {
        it.each([
            ["0 (just below the minimum)", 0],
            ["negative", -100],
            ["a decimal", 10.5],
            ["a numeric string", "1000"],
            ["null", null],
        ])("returns 400 when stakeAmountCents is %s", async(_label, value) => {
            const res = await postBet(validMonetaryBody({ stakeAmountCents: value }));

            expectBadRequest(res, /stakeAmountCents/);
        });
        it("returns 400 when stakeAmountCents is missing", async () => {
            const res = await postBet(without(validMonetaryBody(), "stakeAmountCents"));

            expectBadRequest(res, /stakeAmountCents/);
        });

        it.each([
            ["missing", undefined],
            ["an empty string", ""],
            ["only whitespace", "   "],
            ["not a string", 840],
            ["an unsupported code (\"XYZ\")", "XYZ"],
            ["a real but unsupported code (\"EUR\")", "EUR"],
            ["lowercase (\"usd\")", "usd"],
        ])("returns 400 when currency is %s", async (_label, value) => {
            const body = value === undefined
                ? without(validMonetaryBody(), "currency")
                : validMonetaryBody({ currency: value });

            const res = await postBet(body);

            expectBadRequest(res, /currency/);
        });
    });

    describe("non-monetary stake (400)", () => {
        it.each([
            ["missing", undefined],
            ["an empty string", ""],
            ["only whitespace", "   "],
        ])("returns 400 when stakeDescription is %s", async (_label, value) => {
            const body = value === undefined
                ? without(validNonMonetaryBody(), "stakeDescription")
                : validNonMonetaryBody({ stakeDescription: value });

            const res = await postBet(body);

            expectBadRequest(res, /stakeDescription/);
        });
    });

    describe("spoofed server-controlled fields", () => {
        const spoofedFields = {
            creatorUid: "attacker-uid",
            status: "active",
            participantUids: ["attacker-uid", "someone-else"],
            participantCount: 99,
            sideACount: 50,
            sideBCount: 49,
            createdAt: "2020-01-01T00:00:00.000Z",
            joinedAt: "2020-01-01T00:00:00.000Z",
            id: "attacker-chosen-id",
        };

        it("ignores every spoofed field and uses server values instead", async () => {
            const res = await postBet(validMonetaryBody(spoofedFields));

            expect(res.status).toBe(201);

            const written = dataWrittenTo(mockBetRef);
            expect(written.creatorUid).toBe(TOKEN_UID);
            expect(written.status).toBe("draft");
            expect(written.participantUids).toEqual([TOKEN_UID]);
            expect(written.participantCount).toBe(1);
            expect(written.sideACount).toBe(1);
            expect(written.sideBCount).toBe(0);
            expect(written.createdAt).toEqual(FieldValue.serverTimestamp());
            expect(written).not.toHaveProperty("joinedAt");
            expect(written).not.toHaveProperty("id");

            expect(res.body.bet.id).toBe("generated-bet-id");
            expect(res.body.bet.creatorUid).toBe(TOKEN_UID);
        });

        it("writes the creator participant record with the token uid, not a spoofed one", async () => {
            const res = await postBet(validMonetaryBody(spoofedFields));

            expect(res.status).toBe(201);

            const participant = dataWrittenTo(mockParticipantRef);
            expect(participant).toMatchObject({
                uid: TOKEN_UID,
                side: "A",
                role: "creator",
                termsAcknowledged: true,
            });
            expect(participant.joinedAt).toEqual(FieldValue.serverTimestamp());
        });

        it("ignores a spoofed uid sent in a custom header", async () => {
            const res = await request(app)
                .post("/api/bets")
                .set("Authorization", "Bearer valid-token")
                .set("X-User-Id", "attacker-uid")
                .send(validMonetaryBody());

            expect(res.status).toBe(201);
            expect(dataWrittenTo(mockBetRef).creatorUid).toBe(TOKEN_UID);
        });
    });

    describe("server errors (500)", () => {
        it("returns 500 with the standard error shape when the Firestore write fails", async () => {
            mockBatchCommit.mockRejectedValue(new Error("Firestore unavailable"));
            const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            const res = await postBet(validMonetaryBody());

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ error: "server_error", message: "Unable to create bet." });
            // Internal error details must not leak to the client.
            expect(JSON.stringify(res.body)).not.toMatch(/Firestore unavailable/);

            consoleSpy.mockRestore();
        });
    });
});