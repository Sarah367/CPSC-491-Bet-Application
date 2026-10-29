/**
 * Bet Details integration tests (SCRUM-83).
 *
 * Black-box HTTP tests for GET /api/bets/:id. Each request goes through the real path:
 *   betRoutes -> authMiddleware -> getBetById controller -> betService.getBetById
 *   (Bet read + creator display name lookup) -> betService.getViewerParticipation -> response
 *
 * SCRUM-98 hardened this endpoint: both 404s now return { error: "not_found", message }, and
 * the Bet only includes an explicit allowlist of fields, so participantUids and any other
 * stored-only fields never reach the client. The "client-safe response" tests check that.
 *
 * Firebase Admin is mocked with a small in-memory Firestore. This endpoint only reads, so the
 * fake doesn't need transactions or writes.
 */

const {Timestamp} = require("firebase-admin/firestore");

// in-memory Firestore, reset before each test: Bets by id, and each Bet's participants by uid.
const mockState = {  bets: {}, participants: {}};

// Every Bet read and participant read goes through these , so tests can check which reads happened.
const mockBetGet = jest.fn();
const mockParticipantGet = jest.fn();

function mockSnapshot(id, data) {
    return { id, exists: data !== undefined, data: () => data};
}

jest.mock("../../src/config/firebaseAdmin", () => ({
    auth: {
        verifyIdToken: jest.fn(),
        getUser: jest.fn(),
    },
    db: {
        collection: () => ({
            doc: (betId) => ({
                get: () => mockBetGet(betId),
                collection: () => ({
                    doc: (uid) => ({ get: () => mockParticipantGet(betId, uid) }),
                }),
            }),
        }),
    },
}));

const request = require("supertest");
const app = require("../../src/app");
const { auth } = require("../../src/config/firebaseAdmin");

const BET_ID = "bet-1";
const CREATOR_UID = "creator-uid";
const VIEWER_UID = "viewer-uid";

// Fixed dates, so the ISO strings in the response can be checked exactly.
const CREATED_AT = new Date("2026-10-20T18:00:00.000Z");
const DEADLINE = new Date("2026-11-01T18:00:00.000Z");
const OUTCOME_DEADLINE = new Date("2026-11-02T18:00:00.000Z");

// A public Bet shaped like one made with Create Bet, with the creator on side A.
function seedBet(overrides = {}, betId = BET_ID) {
    mockState.bets[betId] = {
        title: "Will it rain in Fullerton this weekend?",
        description: "Friendly weather bet.",
        outcomeA: "Rain",
        outcomeB: "No rain",
        creatorUid: CREATOR_UID,
        creatorSide: "A",
        visibility: "public",
        resolutionMethod: "external",
        status: "draft",
        stakeType: "non_monetary",
        stakeDescription: "Loser buys coffee",
        createdAt: Timestamp.fromDate(CREATED_AT),
        deadline: Timestamp.fromDate(DEADLINE),
        outcomeDeadline: Timestamp.fromDate(OUTCOME_DEADLINE),
        participantUids: [CREATOR_UID],
        participantCount: 1,
        sideACount: 1,
        sideBCount: 0,
        ...overrides,
    };
    mockState.participants[betId] = {
        [CREATOR_UID]: { uid: CREATOR_UID, side: "A", role: "creator", termsAcknowledged: true },
    };
}

function loginAs(uid, { emailVerified = true } = {}) {
    auth.verifyIdToken.mockResolvedValue({ uid, email_verified: emailVerified });
}

function getBet(betId = BET_ID) {
    return request(app).get(`/api/bets/${betId}`).set("Authorization", "Bearer valid-token");
}

beforeEach(() => {
    jest.clearAllMocks();
    mockState.bets = {};
    mockState.participants = {};
    mockBetGet.mockImplementation(async (betId) => mockSnapshot(betId, mockState.bets[betId]));
    mockParticipantGet.mockImplementation(async (betId, uid) =>
        mockSnapshot(uid, mockState.participants[betId]?.[uid])
    );
    auth.getUser.mockResolvedValue({ displayName: "Bet Creator" });
    loginAs(VIEWER_UID);
    seedBet();
});

describe("GET /api/bets/:id (Bet Details integration)", () => {
    describe("authentication", () => {
        it("returns 401 without a token and never reads the Bet", async () => {
            const res = await request(app).get(`/api/bets/${BET_ID}`);

            expect(res.status).toBe(401);
            expect(res.body).toEqual({ error: "unauthorized", message: expect.any(String) });
            expect(mockBetGet).not.toHaveBeenCalled();
        });

        it("returns 200 for a user who hasn't verified their email, since viewing doesn't require it", async () => {
            loginAs(VIEWER_UID, { emailVerified: false });

            const res = await getBet();

            expect(res.status).toBe(200);
            expect(res.body.bet.id).toBe(BET_ID);
        });
    });

    describe("public Bets", () => {
        it("returns the Bet with the fields the Bet Details page uses", async () => {
            const res = await getBet();

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                bet: expect.objectContaining({
                    id: BET_ID,
                    title: "Will it rain in Fullerton this weekend?",
                    description: "Friendly weather bet.",
                    outcomeA: "Rain",
                    outcomeB: "No rain",
                    creatorUid: CREATOR_UID,
                    creatorDisplayName: "Bet Creator",
                    visibility: "public",
                    resolutionMethod: "external",
                    status: "draft",
                    participantCount: 1,
                }),
                viewerParticipation: null,
            });
        });

        it("converts the Firestore Timestamps to ISO strings", async () => {
            const res = await getBet();

            
            expect(res.body.bet.deadline).toBe(DEADLINE.toISOString());
            expect(res.body.bet.outcomeDeadline).toBe(OUTCOME_DEADLINE.toISOString());
        });
    });

    describe("private Bets and missing Bets", () => {
        it("lets the creator view their own private Bet", async () => {
            seedBet({ visibility: "private" });
            loginAs(CREATOR_UID);

            const res = await getBet();

            expect(res.status).toBe(200);
            expect(res.body.bet).toMatchObject({ id: BET_ID, visibility: "private" });
        });

        it("returns 404 for someone else's private Bet, without reading their participation", async () => {
            seedBet({ visibility: "private" });

            const res = await getBet();

            expect(res.status).toBe(404);
            // Current body. A follow-up ticket may add a message, as long as private and
            // missing Bets still return exactly the same response.
            expect(res.body).toEqual({ error: "not_found", message: "Bet not found." });
            // The private check happens before the participant lookup.
            expect(mockParticipantGet).not.toHaveBeenCalled();
        });

        it("returns the same 404 for a Bet that doesn't exist", async () => {
            const res = await getBet("missing-bet");

            expect(res.status).toBe(404);
            expect(res.body).toEqual({ error: "not_found", message: "Bet not found." });
            expect(mockParticipantGet).not.toHaveBeenCalled();
        });

        it("makes a private Bet indistinguishable from a missing one", async () => {
            seedBet({ visibility: "private" }, "private-bet");

            const privateRes = await getBet("private-bet");
            const missingRes = await getBet("missing-bet");

            expect(privateRes.status).toBe(missingRes.status);
            expect(privateRes.body).toEqual(missingRes.body);
        });
    });

    describe("client-safe response (SCRUM-98)", () => {
        it("returns exactly the allowlisted fields for a non-monetary Bet", async () => {
            const res = await getBet();
 
            expect(Object.keys(res.body.bet).sort()).toEqual([
                "creatorDisplayName",
                "creatorSide",
                "creatorUid",
                "deadline",
                "description",
                "id",
                "outcomeA",
                "outcomeB",
                "outcomeDeadline",
                "participantCount",
                "resolutionMethod",
                "sideACount",
                "sideBCount",
                "stakeDescription",
                "stakeType",
                "status",
                "title",
                "visibility",
            ]);
        });
 
        it("doesn't expose who joined, the creator's terms acknowledgment, or createdAt", async () => {
            seedBet({ termsAcknowledged: true });
 
            const res = await getBet();
 
            expect(res.body.bet).not.toHaveProperty("participantUids");
            expect(res.body.bet).not.toHaveProperty("termsAcknowledged");
            expect(res.body.bet).not.toHaveProperty("createdAt");
        });
 
        it("never exposes a field that isn't on the allowlist, even a new one", async () => {
            seedBet({ internalOnlyField: "should-not-leak" });
 
            const res = await getBet();
 
            expect(res.body.bet).not.toHaveProperty("internalOnlyField");
            expect(JSON.stringify(res.body)).not.toMatch(/should-not-leak/);
        });
 
        it("includes the stake amount and currency for a monetary Bet", async () => {
            seedBet({ stakeType: "monetary", stakeAmountCents: 500, currency: "USD", stakeDescription: undefined });
 
            const res = await getBet();
 
            expect(res.body.bet).toMatchObject({ stakeType: "monetary", stakeAmountCents: 500, currency: "USD" });
            expect(res.body.bet).not.toHaveProperty("stakeDescription");
        });
    });

    describe("creator display name", () => {
        it("returns null and still succeeds when the display name lookup fails", async () => {
            auth.getUser.mockRejectedValue(new Error("auth/user-not-found"));
            const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            const res = await getBet();

            expect(res.status).toBe(200);
            expect(res.body.bet.creatorDisplayName).toBeNull();
            consoleSpy.mockRestore();
        });

        it("returns null when the creator has no display name set", async () => {
            auth.getUser.mockResolvedValue({ displayName: undefined });

            const res = await getBet();

            expect(res.status).toBe(200);
            expect(res.body.bet.creatorDisplayName).toBeNull();
        });
    });

    describe("viewerParticipation", () => {
        it("returns the side and role of a viewer who joined", async () => {
            mockState.participants[BET_ID][VIEWER_UID] = {
                uid: VIEWER_UID,
                side: "B",
                role: "participant",
                termsAcknowledged: true,
            };

            const res = await getBet();

            expect(res.body.viewerParticipation).toEqual({ side: "B", role: "participant" });
        });

        it("returns the creator's side and role for the creator", async () => {
            loginAs(CREATOR_UID);

            const res = await getBet();

            expect(res.body.viewerParticipation).toEqual({ side: "A", role: "creator" });
        });

        it("looks up participation with the token's uid, ignoring a uid in the query string", async () => {
            mockState.participants[BET_ID]["other-uid"] = { uid: "other-uid", side: "B", role: "participant" };

            const res = await getBet(`${BET_ID}?uid=other-uid`);

            expect(res.body.viewerParticipation).toBeNull();
            expect(mockParticipantGet).toHaveBeenCalledWith(BET_ID, VIEWER_UID);
            expect(mockParticipantGet).not.toHaveBeenCalledWith(BET_ID, "other-uid");
        });
    });

    describe("server errors", () => {
        it("returns 500 without leaking details when the Bet read fails", async () => {
            mockBetGet.mockRejectedValue(new Error("Firestore unavailable"));
            const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            const res = await getBet();

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ error: "server_error", message: "Unable to load bet." });
            expect(JSON.stringify(res.body)).not.toMatch(/Firestore unavailable/);
            consoleSpy.mockRestore();
        });
    });
});
