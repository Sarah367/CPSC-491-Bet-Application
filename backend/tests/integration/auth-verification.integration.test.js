/**
 * Authentication + verified-email integration tests (SCRUM-67).
 *
 * Sends real HTTP requests through the real route pipeline for POST /api/bets:
 *   express.json() -> authMiddleware -> requireVerifiedEmail -> createBet controller
 *
 * Already covered in api.integration.test.js (SCRUM-66), so not repeated here:
 * GET /api/protected with a valid token (200), a missing token (401), and a
 * rejected token (401).
 *
 * Firebase Admin is mocked as in SCRUM-66. betService is mocked too: these tests
 * are about the middleware pipeline, not Firestore, and the mock doubles as a
 * guard: if a request that should have been blocked ever reached the service,
 * createBet would be called and the test would fail.
 */
jest.mock("../../src/config/firebaseAdmin", () => ({
    auth: {
        verifyIdToken: jest.fn(),
    },
    db: {},
}));

jest.mock("../../src/services/betService", () => ({
    createBet: jest.fn(),
}));

const request = require("supertest");
const app = require("../../src/app");
const { auth } = require("../../src/config/firebaseAdmin");
const betService = require("../../src/services/betService");

function postBet() {
    return request(app).post("/api/bets").set("Authorization", "Bearer test-token");
}

describe("Authentication and verified-email enforcement", () => {
    beforeEach(() => {
        auth.verifyIdToken.mockReset();
        betService.createBet.mockReset();
    });

    describe("POST /api/bets as an unverified user", () => {
        it("returns 403 email_not_verified when email_verified is false", async () => {
            auth.verifyIdToken.mockResolvedValue({ uid: "test-uid", email_verified: false });

            const res = await postBet().send({});

            expect(res.status).toBe(403);
            expect(res.body.error).toBe("email_not_verified");
            expect(typeof res.body.message).toBe("string");
            expect(betService.createBet).not.toHaveBeenCalled();
        });

        it("returns 403 email_not_verified when the email_verified claim is absent (fails closed)", async () => {
            auth.verifyIdToken.mockResolvedValue({ uid: "test-uid" });

            const res = await postBet().send({});

            expect(res.status).toBe(403);
            expect(res.body.error).toBe("email_not_verified");
            expect(betService.createBet).not.toHaveBeenCalled();
        });
    });

    describe("POST /api/bets as a verified user", () => {
        it("gets past the gate and reaches validation (400, not 403) with an empty body", async () => {
            auth.verifyIdToken.mockResolvedValue({ uid: "test-uid", email_verified: true });

            const res = await postBet().send({});

            expect(res.status).toBe(400);
            expect(res.body.error).not.toBe("email_not_verified");
            expect(res.body.message).toBe("title is required.");
            expect(betService.createBet).not.toHaveBeenCalled();
        });
    });

    describe("spoofing verification status as an unverified user", () => {
        beforeEach(() => {
            auth.verifyIdToken.mockResolvedValue({ uid: "test-uid", email_verified: false });
        });

        it("ignores email_verified: true in the request body", async () => {
            const res = await postBet().send({ email_verified: true });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe("email_not_verified");
            expect(betService.createBet).not.toHaveBeenCalled();
        });

        it("ignores an X-Email-Verified: true header", async () => {
            const res = await postBet().set("X-Email-Verified", "true").send({});

            expect(res.status).toBe(403);
            expect(res.body.error).toBe("email_not_verified");
            expect(betService.createBet).not.toHaveBeenCalled();
        });

        it("ignores creatorUid and uid in the request body", async () => {
            const res = await postBet().send({ creatorUid: "someone-else", uid: "someone-else" });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe("email_not_verified");
            expect(betService.createBet).not.toHaveBeenCalled();
        });
    });
});
