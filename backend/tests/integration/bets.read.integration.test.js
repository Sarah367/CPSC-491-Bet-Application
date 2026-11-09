/**
 * Bet read endpoint integration tests (SCRUM-69).
 *
 * Black-box HTTP tests for:
 *   GET /api/bets/mine   (SCRUM-37, SCRUM-57) -> authMiddleware -> listMyBets -> betService.getBetsForUser
 *   GET /api/bets/public (SCRUM-31) -> authMiddleware -> listPublicBets -> betService.listPublicBets
 *
 * Scope: these tests cover the HTTP contract (route wiring, authentication, which Firestore
 * query is run, response shape, sorting, date conversion, and error responses). They do not
 * repeat the teammate-owned unit tests for the controller and service functions.
 *
 * Firebase Admin is mocked, so nothing touches the real Firestore project. The mock records
 * the collection(...) and where(...) calls, and each test chooses which documents get(...)
 * returns, so results are deterministic. get(...) receives the where(...) arguments, so the
 * My Bets tests can give the "created" and "joined" queries different results (SCRUM-57).
 */
const { Timestamp } = require("firebase-admin/firestore");

const mockGet = jest.fn();
const mockWhere = jest.fn((...filter) => ({ get: () => mockGet(...filter) }));
const mockCollection = jest.fn(() => ({ where: mockWhere }));

jest.mock("../../src/config/firebaseAdmin", () => ({
    auth: {
        verifyIdToken: jest.fn(),
    },
    db: {
        collection: (...args) => mockCollection(...args),
    },
}));

const request = require("supertest");
const app = require("../../src/app");
const { auth } = require("../../src/config/firebaseAdmin");

const TOKEN_UID = "token-uid";
const OTHER_UID = "other-uid";

// Real Firestore Timestamps, because the services check `instanceof Timestamp`
// before converting dates to ISO strings. This does not connect to Firebase.
function ts(iso) {
    return Timestamp.fromDate(new Date(iso));
}

// A fake Firestore document, shaped like what snapshot.docs contains.
function makeBetDoc(id, data) {
    return { id, data: () => data };
}

// A full Bet record, like the ones SCRUM-53 writes. Tests override what they need.
function betData(overrides = {}) {
    return {
        title: "Will it rain on Friday?",
        description: "Friendly weather bet.",
        outcomeA: "Rain",
        outcomeB: "No rain",
        creatorUid: TOKEN_UID,
        creatorSide: "A",
        visibility: "public",
        resolutionMethod: "external",
        status: "draft",
        stakeType: "monetary",
        stakeAmountCents: 500,
        currency: "USD",
        participantUids: [TOKEN_UID],
        participantCount: 1,
        sideACount: 1,
        sideBCount: 0,
        deadline: ts("2026-10-20T18:00:00.000Z"),
        outcomeDeadline: ts("2026-10-21T18:00:00.000Z"),
        createdAt: ts("2026-10-08T10:00:00.000Z"),
        ...overrides,
    };
}

function returnDocs(docs) {
    mockGet.mockResolvedValue({ docs });
}

// My Bets runs two queries (SCRUM-57): created Bets by creatorUid, and joined Bets by
// participantUids. This answers each one with its own documents.
function returnMyBets({ created = [], joined = [] }) {
    mockGet.mockImplementation((field) => {
        if (field === "creatorUid") {
            return Promise.resolve({ docs: created });
        }
        if (field === "participantUids") {
            return Promise.resolve({ docs: joined });
        }
        return Promise.resolve({ docs: [] });
    });
}

// A public Bet created by someone else that TOKEN_UID joined on side B.
function joinedBetData(overrides = {}) {
    return betData({
        creatorUid: OTHER_UID,
        participantUids: [OTHER_UID, TOKEN_UID],
        participantCount: 2,
        sideBCount: 1,
        ...overrides,
    });
}

function getAsUser(path) {
    return request(app).get(path).set("Authorization", "Bearer valid-token");
}

beforeEach(() => {
    jest.clearAllMocks();
    auth.verifyIdToken.mockResolvedValue({ uid: TOKEN_UID, email_verified: true });
    returnDocs([]);
});

describe("GET /api/bets/mine (My Bets integration)", () => {
    describe("authentication (401)", () => {
        it("returns 401 when the Authorization header is missing", async () => {
            const res = await request(app).get("/api/bets/mine");

            expect(res.status).toBe(401);
            expect(res.body).toEqual({ error: "unauthorized", message: expect.any(String) });
            expect(auth.verifyIdToken).not.toHaveBeenCalled();
            expect(mockCollection).not.toHaveBeenCalled();
        });

        it("returns 401 when Firebase rejects the token", async () => {
            auth.verifyIdToken.mockRejectedValue(new Error("auth/id-token-expired"));
            const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            const res = await getAsUser("/api/bets/mine");

            expect(res.status).toBe(401);
            expect(res.body).toEqual({ error: "unauthorized", message: expect.any(String) });
            expect(mockCollection).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });

    describe("successful responses (200)", () => {
        it("runs one query for created Bets and one for joined Bets, both with the token uid", async () => {
            const res = await getAsUser("/api/bets/mine");

            expect(res.status).toBe(200);
            expect(mockCollection).toHaveBeenCalledWith("bets");
            expect(mockWhere).toHaveBeenCalledTimes(2);
            expect(mockWhere).toHaveBeenCalledWith("creatorUid", "==", TOKEN_UID);
            expect(mockWhere).toHaveBeenCalledWith("participantUids", "array-contains", TOKEN_UID);
        });

        it("returns the user's own Bets, including private ones, with stake details", async () => {
            const own = makeBetDoc("bet-1", betData({ visibility: "private" }));
            returnMyBets({ created: [own], joined: [own] });

            const res = await getAsUser("/api/bets/mine");

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                bets: [
                    {
                        id: "bet-1",
                        title: "Will it rain on Friday?",
                        status: "draft",
                        visibility: "private",
                        stakeType: "monetary",
                        stakeAmountCents: 500,
                        currency: "USD",
                        deadline: "2026-10-20T18:00:00.000Z",
                        createdAt: "2026-10-08T10:00:00.000Z",
                        viewerRole: "creator",
                    },
                ],
            });
        });

        it("returns a Bet the user joined, labeled as a participant", async () => {
            returnMyBets({ joined: [makeBetDoc("joined-1", joinedBetData())] });

            const res = await getAsUser("/api/bets/mine");

            expect(res.status).toBe(200);
            expect(res.body.bets).toHaveLength(1);
            expect(res.body.bets[0]).toMatchObject({ id: "joined-1", viewerRole: "participant" });
        });

        it("returns a created Bet once even though both queries find it", async () => {
            const own = makeBetDoc("own-1", betData());
            returnMyBets({ created: [own], joined: [own] });

            const res = await getAsUser("/api/bets/mine");

            expect(res.status).toBe(200);
            expect(res.body.bets.map((bet) => bet.id)).toEqual(["own-1"]);
        });

        it("still returns a Bet created before participantUids existed", async () => {
            const legacy = betData();
            delete legacy.participantUids;
            returnMyBets({ created: [makeBetDoc("legacy-1", legacy)] });

            const res = await getAsUser("/api/bets/mine");

            expect(res.status).toBe(200);
            expect(res.body.bets).toHaveLength(1);
            expect(res.body.bets[0]).toMatchObject({ id: "legacy-1", viewerRole: "creator" });
        });

        it("never sends participantUids, termsAcknowledged, creatorUid, or unknown fields", async () => {
            returnMyBets({
                joined: [makeBetDoc("joined-1", joinedBetData({
                    termsAcknowledged: true,
                    internalOnlyField: "never send this",
                }))],
            });

            const res = await getAsUser("/api/bets/mine");

            expect(res.status).toBe(200);
            expect(Object.keys(res.body.bets[0]).sort()).toEqual([
                "createdAt",
                "currency",
                "deadline",
                "id",
                "stakeAmountCents",
                "stakeType",
                "status",
                "title",
                "viewerRole",
                "visibility",
            ]);
            // The other participant's uid must not reach the viewer anywhere in the response.
            expect(JSON.stringify(res.body)).not.toContain(OTHER_UID);
        });

        it("converts createdAt and deadline Timestamps to ISO strings", async () => {
            returnMyBets({ created: [makeBetDoc("bet-1", betData())] });

            const res = await getAsUser("/api/bets/mine");

            expect(res.status).toBe(200);
            expect(res.body.bets[0].createdAt).toBe("2026-10-08T10:00:00.000Z");
            expect(res.body.bets[0].deadline).toBe("2026-10-20T18:00:00.000Z");
        });

        it("returns 200 with an empty list when the user has no Bets", async () => {
            const res = await getAsUser("/api/bets/mine");

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ bets: [] });
        });

        it("sorts created and joined Bets together, newest first", async () => {
            returnMyBets({
                created: [
                    makeBetDoc("older", betData({ createdAt: ts("2026-10-01T10:00:00.000Z") })),
                    makeBetDoc("newest", betData({ createdAt: ts("2026-10-08T10:00:00.000Z") })),
                ],
                joined: [
                    makeBetDoc("middle", joinedBetData({ createdAt: ts("2026-10-05T10:00:00.000Z") })),
                ],
            });

            const res = await getAsUser("/api/bets/mine");

            expect(res.status).toBe(200);
            expect(res.body.bets.map((bet) => bet.id)).toEqual(["newest", "middle", "older"]);
        });
    });

    describe("limit (SCRUM-106)", () => {
        // The newest three mix created and joined Bets, so the limit has to be applied
        // after the merge and the newest-first sort.
        function returnMixedBets() {
            returnMyBets({
                created: [
                    makeBetDoc("created-1", betData({ createdAt: ts("2026-10-09T10:00:00.000Z") })),
                    makeBetDoc("created-2", betData({ createdAt: ts("2026-10-06T10:00:00.000Z") })),
                ],
                joined: [
                    makeBetDoc("joined-1", joinedBetData({ createdAt: ts("2026-10-10T10:00:00.000Z") })),
                    makeBetDoc("joined-2", joinedBetData({ createdAt: ts("2026-10-08T10:00:00.000Z") })),
                ],
            });
        }

        it("returns only the newest Bets across created and joined", async () => {
            returnMixedBets();

            const res = await getAsUser("/api/bets/mine?limit=3");

            expect(res.status).toBe(200);
            expect(res.body.bets.map((bet) => bet.id)).toEqual(["joined-1", "created-1", "joined-2"]);
            expect(res.body.bets[0]).toMatchObject({ viewerRole: "participant" });
            expect(res.body.bets[1]).toMatchObject({ viewerRole: "creator" });
        });

        it("finds the newest Bets even when a query returns more than the limit, out of order", async () => {
            returnMyBets({
                created: [
                    makeBetDoc("middle", betData({ createdAt: ts("2026-10-05T10:00:00.000Z") })),
                    makeBetDoc("oldest", betData({ createdAt: ts("2026-10-01T10:00:00.000Z") })),
                    makeBetDoc("newest", betData({ createdAt: ts("2026-10-09T10:00:00.000Z") })),
                ],
            });

            const res = await getAsUser("/api/bets/mine?limit=2");

            expect(res.status).toBe(200);
            expect(res.body.bets.map((bet) => bet.id)).toEqual(["newest", "middle"]);
        });

        it("returns every Bet when there's no limit", async () => {
            returnMixedBets();

            const res = await getAsUser("/api/bets/mine");

            expect(res.status).toBe(200);
            expect(res.body.bets).toHaveLength(4);
        });

        it("keeps the same response fields with a limit", async () => {
            returnMixedBets();

            const res = await getAsUser("/api/bets/mine?limit=1");

            expect(res.status).toBe(200);
            expect(Object.keys(res.body.bets[0]).sort()).toEqual([
                "createdAt",
                "currency",
                "deadline",
                "id",
                "stakeAmountCents",
                "stakeType",
                "status",
                "title",
                "viewerRole",
                "visibility",
            ]);
            expect(JSON.stringify(res.body)).not.toContain(OTHER_UID);
        });

        it.each([
            ["a decimal", "limit=2.5"],
            ["zero", "limit=0"],
            ["above the maximum", "limit=51"],
            ["empty", "limit="],
            ["repeated", "limit=3&limit=5"],
        ])("returns 400 for %s without querying Firestore", async (_label, query) => {
            const res = await getAsUser(`/api/bets/mine?${query}`);

            expect(res.status).toBe(400);
            expect(res.body).toEqual({
                error: "invalid_request",
                message: "limit must be a whole number between 1 and 50.",
            });
            expect(mockWhere).not.toHaveBeenCalled();
        });

        it("still requires a token", async () => {
            const res = await request(app).get("/api/bets/mine?limit=3");

            expect(res.status).toBe(401);
        });
    });

    describe("identity comes only from the verified token", () => {
        it("ignores a spoofed uid in the query string, request body, and X-User-Id header", async () => {
            const res = await request(app)
                .get(`/api/bets/mine?uid=${OTHER_UID}&creatorUid=${OTHER_UID}`)
                .set("Authorization", "Bearer valid-token")
                .set("X-User-Id", OTHER_UID)
                .send({ uid: OTHER_UID, creatorUid: OTHER_UID });

            expect(res.status).toBe(200);
            expect(mockWhere).toHaveBeenCalledTimes(2);
            expect(mockWhere).toHaveBeenCalledWith("creatorUid", "==", TOKEN_UID);
            expect(mockWhere).toHaveBeenCalledWith("participantUids", "array-contains", TOKEN_UID);
            expect(mockWhere).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), OTHER_UID);
        });
    });

    describe("server errors (500)", () => {
        it("returns 500 with the standard error shape when the Firestore read fails", async () => {
            mockGet.mockRejectedValue(new Error("Firestore unavailable"));
            const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            const res = await getAsUser("/api/bets/mine");

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ error: "server_error", message: "Unable to load your bets." });
            // Internal error details must not leak to the client.
            expect(JSON.stringify(res.body)).not.toMatch(/Firestore unavailable/);

            consoleSpy.mockRestore();
        });

        it("returns 500 when only the joined-Bets query fails", async () => {
            mockGet.mockImplementation((field) => (field === "participantUids"
                ? Promise.reject(new Error("Firestore unavailable"))
                : Promise.resolve({ docs: [makeBetDoc("bet-1", betData())] })));
            const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            const res = await getAsUser("/api/bets/mine");

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ error: "server_error", message: "Unable to load your bets." });

            consoleSpy.mockRestore();
        });
    });
});

describe("GET /api/bets/public (public Bet listing integration)", () => {
    const PUBLIC_FIELDS = ["createdAt", "creatorUid", "deadline", "id", "status", "title", "visibility"];

    describe("authentication (401)", () => {
        it("returns 401 when the Authorization header is missing", async () => {
            const res = await request(app).get("/api/bets/public");

            expect(res.status).toBe(401);
            expect(res.body).toEqual({ error: "unauthorized", message: expect.any(String) });
            expect(auth.verifyIdToken).not.toHaveBeenCalled();
            expect(mockCollection).not.toHaveBeenCalled();
        });

        it("returns 401 when Firebase rejects the token", async () => {
            auth.verifyIdToken.mockRejectedValue(new Error("auth/argument-error"));
            const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            const res = await getAsUser("/api/bets/public");

            expect(res.status).toBe(401);
            expect(res.body).toEqual({ error: "unauthorized", message: expect.any(String) });
            expect(mockCollection).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });

    describe("successful responses (200)", () => {
        it("queries for public Bets and returns Bets from any creator", async () => {
            returnDocs([
                makeBetDoc("mine", betData({ creatorUid: TOKEN_UID })),
                makeBetDoc("theirs", betData({
                    creatorUid: OTHER_UID,
                    createdAt: ts("2026-10-07T10:00:00.000Z"),
                })),
            ]);

            const res = await getAsUser("/api/bets/public");

            expect(res.status).toBe(200);
            expect(mockCollection).toHaveBeenCalledWith("bets");
            expect(mockWhere).toHaveBeenCalledTimes(1);
            expect(mockWhere).toHaveBeenCalledWith("visibility", "==", "public");
            // The listing is not limited to the logged-in user's own Bets.
            expect(mockWhere).not.toHaveBeenCalledWith("creatorUid", "==", expect.anything());
            expect(res.body.bets.map((bet) => bet.creatorUid)).toEqual([TOKEN_UID, OTHER_UID]);
        });

        it("returns only the 7 public listing fields, with dates as ISO strings", async () => {
            returnDocs([makeBetDoc("bet-1", betData())]);

            const res = await getAsUser("/api/bets/public");

            expect(res.status).toBe(200);
            expect(Object.keys(res.body.bets[0]).sort()).toEqual(PUBLIC_FIELDS);
            expect(res.body.bets[0]).toEqual({
                id: "bet-1",
                title: "Will it rain on Friday?",
                deadline: "2026-10-20T18:00:00.000Z",
                visibility: "public",
                status: "draft",
                creatorUid: TOKEN_UID,
                createdAt: "2026-10-08T10:00:00.000Z",
            });
        });

        it("does not expose stake details, participants, or other internal fields", async () => {
            returnDocs([makeBetDoc("bet-1", betData())]);

            const res = await getAsUser("/api/bets/public");

            expect(res.status).toBe(200);
            const bet = res.body.bets[0];
            [
                "description",
                "stakeAmountCents",
                "currency",
                "participantUids",
                "participantCount",
                "sideACount",
                "sideBCount",
                "outcomeA",
                "outcomeB",
            ].forEach((field) => expect(bet).not.toHaveProperty(field));
        });

        it("returns 200 with an empty list when there are no public Bets", async () => {
            const res = await getAsUser("/api/bets/public");

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ bets: [] });
        });

        it("sorts Bets newest first even when Firestore returns them out of order", async () => {
            returnDocs([
                makeBetDoc("older", betData({ createdAt: ts("2026-10-01T10:00:00.000Z") })),
                makeBetDoc("newest", betData({ createdAt: ts("2026-10-08T10:00:00.000Z") })),
                makeBetDoc("middle", betData({ createdAt: ts("2026-10-05T10:00:00.000Z") })),
            ]);

            const res = await getAsUser("/api/bets/public");

            expect(res.status).toBe(200);
            expect(res.body.bets.map((bet) => bet.id)).toEqual(["newest", "middle", "older"]);
        });
    });

    describe("server errors (500)", () => {
        it("returns 500 with the standard error shape when the Firestore read fails", async () => {
            mockGet.mockRejectedValue(new Error("Firestore unavailable"));
            const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            const res = await getAsUser("/api/bets/public");

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ error: "server_error", message: "Unable to list public bets." });
            // Internal error details must not leak to the client.
            expect(JSON.stringify(res.body)).not.toMatch(/Firestore unavailable/);

            consoleSpy.mockRestore();
        });
    });
});