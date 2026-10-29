/**
 * Join and auto-activation integration tests (SCRUM-70).
 *
 * Black-box HTTP tests for POST /api/bets/:id/join. Each request goes through the real path:
 *   express.json() -> betRoutes -> authMiddleware -> requireVerifiedEmail -> joinBet controller
 *   -> joinBet service (Firestore transaction) -> getBetById re-read -> response
 *
 * Scope: these tests check the HTTP contract and that the pieces work together. The detailed
 * rules (every closed status, exact deadline boundaries, every activation combination) are
 * already covered by the SCRUM-54 and SCRUM-55 unit tests, so they aren't repeated here.
 *
 * Firebase Admin is mocked with a small in-memory Firestore. The fake transaction really
 * changes that state when it writes, so the re-read after the transaction (and the response)
 * shows the result of the join, the same way real Firestore would.
 */
const { FieldValue, Timestamp } = require("firebase-admin/firestore");

// In-memory Firestore: one Bet document per id, and each Bet's participants by uid.
// Reset before every test, so one test's join never leaks into the next.
const mockState = { bets: {}, participants: {} };

function mockSnapshot(id, data) {
    return { id, exists: data !== undefined, data: () => data };
}

function mockParticipantRef(betId, uid) {
    return {
        kind: "participant",
        betId,
        uid,
        get: async () => mockSnapshot(uid, mockState.participants[betId]?.[uid]),
    };
}

function mockBetRef(betId) {
    return {
        kind: "bet",
        betId,
        // Used by the getBetById re-read after the transaction, outside the transaction.
        get: async () => mockSnapshot(betId, mockState.bets[betId]),
        collection: () => ({ doc: (uid) => mockParticipantRef(betId, uid) }),
    };
}

// Applies Firestore's special values the way the real server would.
// .isEqual() is Firestore's own comparison, so the tests don't depend on its internals.
function mockApplyUpdate(betId, updates) {
    const bet = mockState.bets[betId];
    for (const [field, value] of Object.entries(updates)) {
        if (value?.isEqual?.(FieldValue.increment(1))) {
            bet[field] = (bet[field] ?? 0) + 1;
        } else if (field === "participantUids") {
            // arrayUnion(uid) adds the joining uid once. The uid is the participant being written.
            const uid = mockLastParticipantUid;
            if (!value.isEqual(FieldValue.arrayUnion(uid))) {
                throw new Error("participantUids must be updated with arrayUnion(joining uid)");
            }
            if (!bet.participantUids.includes(uid)) {
                bet.participantUids = [...bet.participantUids, uid];
            }
        } else {
            bet[field] = value;
        }
    }
}

let mockLastParticipantUid = null;

const mockTransaction = {
    get: jest.fn((ref) => ref.get()),
    set: jest.fn((ref, data) => {
        mockLastParticipantUid = ref.uid;
        mockState.participants[ref.betId] = {
            ...mockState.participants[ref.betId],
            [ref.uid]: { ...data, joinedAt: Timestamp.now() },
        };
    }),
    update: jest.fn((ref, updates) => mockApplyUpdate(ref.betId, updates)),
};

const mockRunTransaction = jest.fn();

jest.mock("../../src/config/firebaseAdmin", () => ({
    auth: {
        verifyIdToken: jest.fn(),
        getUser: jest.fn(),
    },
    db: {
        collection: () => ({ doc: (id) => mockBetRef(id) }),
        runTransaction: (...args) => mockRunTransaction(...args),
    },
}));

const request = require("supertest");
const app = require("../../src/app");
const { auth } = require("../../src/config/firebaseAdmin");

const BET_ID = "bet-1";
const CREATOR_UID = "creator-uid";
const JOINER_UID = "joiner-uid";
const DAY_MS = 24 * 60 * 60 * 1000;

// A public Draft Bet whose creator is on side A, like one just made with Create Bet.
// The deadline is relative to now, so these tests never go stale.
function seedBet(overrides = {}) {
    mockState.bets[BET_ID] = {
        title: "Will it rain in Fullerton this weekend?",
        outcomeA: "Rain",
        outcomeB: "No rain",
        creatorUid: CREATOR_UID,
        creatorSide: "A",
        visibility: "public",
        status: "draft",
        deadline: Timestamp.fromDate(new Date(Date.now() + DAY_MS)),
        createdAt: Timestamp.fromDate(new Date(Date.now() - DAY_MS)),
        participantUids: [CREATOR_UID],
        participantCount: 1,
        sideACount: 1,
        sideBCount: 0,
        ...overrides,
    };
    mockState.participants[BET_ID] = {
        [CREATOR_UID]: { uid: CREATOR_UID, side: "A", role: "creator", termsAcknowledged: true },
    };
}

function joinAs(body, betId = BET_ID) {
    return request(app)
        .post(`/api/bets/${betId}/join`)
        .set("Authorization", "Bearer valid-token")
        .send(body);
}

function expectNoWrites() {
    expect(mockTransaction.set).not.toHaveBeenCalled();
    expect(mockTransaction.update).not.toHaveBeenCalled();
}

beforeEach(() => {
    jest.clearAllMocks();
    mockState.bets = {};
    mockState.participants = {};
    mockLastParticipantUid = null;
    mockRunTransaction.mockImplementation((callback) => callback(mockTransaction));
    auth.verifyIdToken.mockResolvedValue({ uid: JOINER_UID, email_verified: true });
    auth.getUser.mockResolvedValue({ displayName: "Bet Creator" });
    seedBet();
});

describe("POST /api/bets/:id/join (join and auto-activation integration)", () => {
    describe("authentication and verification", () => {
        it("returns 401 without a token and never starts a transaction", async () => {
            const res = await request(app)
                .post(`/api/bets/${BET_ID}/join`)
                .send({ side: "B", termsAcknowledged: true });

            expect(res.status).toBe(401);
            expect(res.body).toEqual({ error: "unauthorized", message: expect.any(String) });
            expect(mockRunTransaction).not.toHaveBeenCalled();
        });

        it("returns 403 for a logged-in user who hasn't verified their email", async () => {
            auth.verifyIdToken.mockResolvedValue({ uid: JOINER_UID, email_verified: false });

            const res = await joinAs({ side: "B", termsAcknowledged: true });

            expect(res.status).toBe(403);
            expect(res.body).toEqual({ error: "email_not_verified", message: expect.any(String) });
            expect(mockRunTransaction).not.toHaveBeenCalled();
        });
    });

    describe("request validation (400)", () => {
        it.each([
            ["a lowercase side", { side: "b", termsAcknowledged: true }],
            ["a side that isn't A or B", { side: "C", termsAcknowledged: true }],
            ["termsAcknowledged as the string \"true\"", { side: "B", termsAcknowledged: "true" }],
            ["termsAcknowledged missing", { side: "B" }],
        ])("returns 400 for %s and never starts a transaction", async (_label, body) => {
            const res = await joinAs(body);

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ error: "invalid_request", message: expect.any(String) });
            expect(mockRunTransaction).not.toHaveBeenCalled();
        });
    });

    describe("Bets that can't be joined", () => {
        it("returns 404 for a Bet that doesn't exist", async () => {
            const res = await joinAs({ side: "B", termsAcknowledged: true }, "missing-bet");

            expect(res.status).toBe(404);
            expect(res.body).toEqual({ error: "not_found", message: expect.any(String) });
            expectNoWrites();
        });

        it("returns the same 404 for a private Bet, so its existence isn't revealed", async () => {
            seedBet({ visibility: "private" });

            const res = await joinAs({ side: "B", termsAcknowledged: true });

            expect(res.status).toBe(404);
            expect(res.body).toEqual({ error: "not_found", message: expect.any(String) });
            expectNoWrites();
        });

        it("returns 409 when the creator tries to join their own Bet", async () => {
            auth.verifyIdToken.mockResolvedValue({ uid: CREATOR_UID, email_verified: true });

            const res = await joinAs({ side: "B", termsAcknowledged: true });

            expect(res.status).toBe(409);
            expect(res.body).toEqual({ error: "creator_cannot_join", message: expect.any(String) });
            expectNoWrites();
        });

        it("returns 409 when the user has already joined", async () => {
            mockState.participants[BET_ID][JOINER_UID] = { uid: JOINER_UID, side: "B", role: "participant" };

            const res = await joinAs({ side: "B", termsAcknowledged: true });

            expect(res.status).toBe(409);
            expect(res.body).toEqual({ error: "already_joined", message: expect.any(String) });
            expectNoWrites();
        });

        it.each([
            ["is locked", { status: "locked" }],
            ["is past its deadline", { deadline: Timestamp.fromDate(new Date(Date.now() - 1000)) }],
        ])("returns 409 when the Bet %s", async (_label, overrides) => {
            seedBet(overrides);

            const res = await joinAs({ side: "B", termsAcknowledged: true });

            expect(res.status).toBe(409);
            expect(res.body).toEqual({ error: "bet_closed", message: expect.any(String) });
            expectNoWrites();
        });
    });

    describe("successful joins", () => {
        it("joins the opposite side and activates the Draft Bet", async () => {
            const res = await joinAs({ side: "B", termsAcknowledged: true });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                message: "Joined bet successfully.",
                bet: expect.objectContaining({
                    id: BET_ID,
                    status: "active",
                    participantCount: 2,
                    sideACount: 1,
                    sideBCount: 1,
                    creatorDisplayName: "Bet Creator",
                }),
                viewerParticipation: { side: "B", role: "participant" },
            });

            // The join and the activation are one write, inside one transaction.
            expect(mockRunTransaction).toHaveBeenCalledTimes(1);
            expect(mockTransaction.update).toHaveBeenCalledTimes(1);
            expect(mockTransaction.update.mock.calls[0][1].status).toBe("active");
            // The joiner was added to the stored participant list, but that list is never sent
            // back to the client (SCRUM-98).
            expect(mockState.bets[BET_ID].participantUids).toEqual([CREATOR_UID, JOINER_UID]);
            expect(res.body.bet).not.toHaveProperty("participantUids");
            // The joiner's participant record was written with the token's uid.
            expect(mockState.participants[BET_ID][JOINER_UID]).toMatchObject({
                uid: JOINER_UID,
                side: "B",
                role: "participant",
                termsAcknowledged: true,
            });
        });

        it("joins the creator's side and keeps the Bet a Draft", async () => {
            const res = await joinAs({ side: "A", termsAcknowledged: true });

            expect(res.status).toBe(200);
            expect(res.body.bet).toMatchObject({
                status: "draft",
                participantCount: 2,
                sideACount: 2,
                sideBCount: 0,
            });
            expect(res.body.viewerParticipation).toEqual({ side: "A", role: "participant" });
            expect(mockTransaction.update.mock.calls[0][1]).not.toHaveProperty("status");
        });

        it("lets more people join an Active Bet without changing its status again", async () => {
            seedBet({
                status: "active",
                participantUids: [CREATOR_UID, "earlier-uid"],
                participantCount: 2,
                sideACount: 1,
                sideBCount: 1,
            });

            const res = await joinAs({ side: "B", termsAcknowledged: true });

            expect(res.status).toBe(200);
            expect(res.body.bet).toMatchObject({ status: "active", participantCount: 3, sideBCount: 2 });
            expect(mockTransaction.update.mock.calls[0][1]).not.toHaveProperty("status");
        });

        it("activates only when the second side gets someone, across two joins", async () => {
            // First, someone else joins side A: still everyone on one side, so still a Draft.
            auth.verifyIdToken.mockResolvedValueOnce({ uid: "first-joiner", email_verified: true });
            const first = await joinAs({ side: "A", termsAcknowledged: true });
            expect(first.body.bet).toMatchObject({ status: "draft", participantCount: 2 });

            // Then the joiner picks side B, so both sides have someone and the Bet goes live.
            const second = await joinAs({ side: "B", termsAcknowledged: true });
            expect(second.body.bet).toMatchObject({
                status: "active",
                participantCount: 3,
                sideACount: 2,
                sideBCount: 1,
            });
        });
    });

    describe("fields only the server controls", () => {
        it("ignores a spoofed uid, creatorUid, and status in the request body", async () => {
            const res = await joinAs({
                side: "A",
                termsAcknowledged: true,
                uid: "attacker-uid",
                creatorUid: "attacker-uid",
                status: "active",
            });

            expect(res.status).toBe(200);
            // The participant is the token's uid, not the one in the body.
            expect(mockState.participants[BET_ID]).toHaveProperty(JOINER_UID);
            expect(mockState.participants[BET_ID]).not.toHaveProperty("attacker-uid");
            // The creator is unchanged, and a same-side join stays a Draft even though
            // the body asked for "active".
            expect(res.body.bet).toMatchObject({ creatorUid: CREATOR_UID, status: "draft" });
        });
    });

    describe("server errors", () => {
        it("returns 500 without leaking details when the transaction fails", async () => {
            mockRunTransaction.mockRejectedValue(new Error("Firestore unavailable"));
            const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            const res = await joinAs({ side: "B", termsAcknowledged: true });

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ error: "server_error", message: "Unable to join bet." });
            expect(JSON.stringify(res.body)).not.toMatch(/Firestore unavailable/);

            consoleSpy.mockRestore();
        });
    });
});