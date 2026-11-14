// Firebase Admin is mocked so nothing touches the real Firestore project.
// The mock answers each where() query separately, so a test can give the
// "created" query and the "joined" query different results.
const mockWhere = jest.fn();
const mockQueryResults = new Map();

jest.mock("../src/config/firebaseAdmin", () => ({
    db: {
        collection: jest.fn(() => ({ where: mockWhere })),
    },
}));

const { Timestamp } = require("firebase-admin/firestore");
const { db } = require("../src/config/firebaseAdmin");
const { getBetsForUser } = require("../src/services/betService");

const UID = "user-a";
const OTHER_UID = "user-b";
const CREATED_QUERY = "creatorUid ==";
const JOINED_QUERY = "participantUids array-contains";

function ts(iso) {
    return Timestamp.fromDate(new Date(iso));
}

function fakeDoc(id, data) {
    return { id, data: () => data };
}

function betData(overrides = {}) {
    return {
        title: "A Bet",
        status: "draft",
        visibility: "public",
        stakeType: "nonMonetary",
        stakeDescription: "Loser buys coffee",
        creatorUid: UID,
        participantUids: [UID],
        deadline: ts("2026-11-20T18:00:00.000Z"),
        createdAt: ts("2026-10-08T10:00:00.000Z"),
        ...overrides,
    };
}

function returnCreated(docs) {
    mockQueryResults.set(CREATED_QUERY, () => Promise.resolve({ docs }));
}

function returnJoined(docs) {
    mockQueryResults.set(JOINED_QUERY, () => Promise.resolve({ docs }));
}

describe("getBetsForUser", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockQueryResults.clear();
        returnCreated([]);
        returnJoined([]);
        mockWhere.mockImplementation((field, op) => ({
            get: () => mockQueryResults.get(`${field} ${op}`)(),
        }));
    });

    it("runs one query for created Bets and one for joined Bets, both with the uid", async () => {
        await getBetsForUser(UID);

        expect(db.collection).toHaveBeenCalledWith("bets");
        expect(mockWhere).toHaveBeenCalledTimes(2);
        expect(mockWhere).toHaveBeenCalledWith("creatorUid", "==", UID);
        expect(mockWhere).toHaveBeenCalledWith("participantUids", "array-contains", UID);
    });

    it("returns an empty list when the user has no Bets", async () => {
        await expect(getBetsForUser(UID)).resolves.toEqual([]);
    });

    it("returns a Bet the user created before participantUids existed", async () => {
        const legacy = betData();
        delete legacy.participantUids;
        returnCreated([fakeDoc("legacy-bet", legacy)]);

        const bets = await getBetsForUser(UID);

        expect(bets.map((bet) => bet.id)).toEqual(["legacy-bet"]);
        expect(bets[0].viewerRole).toBe("creator");
    });

    it("returns a Bet the user joined, labeled as a participant", async () => {
        returnJoined([
            fakeDoc("joined-bet", betData({
                creatorUid: OTHER_UID,
                participantUids: [OTHER_UID, UID],
            })),
        ]);

        const bets = await getBetsForUser(UID);

        expect(bets.map((bet) => bet.id)).toEqual(["joined-bet"]);
        expect(bets[0].viewerRole).toBe("participant");
    });

    it("returns a created Bet once when both queries find it", async () => {
        const doc = fakeDoc("own-bet", betData());
        returnCreated([doc]);
        returnJoined([doc]);

        const bets = await getBetsForUser(UID);

        expect(bets).toHaveLength(1);
        expect(bets[0]).toMatchObject({ id: "own-bet", viewerRole: "creator" });
    });

    it("merges created and joined Bets and sorts them newest first", async () => {
        returnCreated([
            fakeDoc("created-old", betData({ createdAt: ts("2026-10-01T10:00:00.000Z") })),
            fakeDoc("created-new", betData({ createdAt: ts("2026-10-09T10:00:00.000Z") })),
        ]);
        returnJoined([
            fakeDoc("joined-middle", betData({
                creatorUid: OTHER_UID,
                participantUids: [OTHER_UID, UID],
                createdAt: ts("2026-10-05T10:00:00.000Z"),
            })),
        ]);

        const bets = await getBetsForUser(UID);

        expect(bets.map((bet) => bet.id)).toEqual(["created-new", "joined-middle", "created-old"]);
    });

    it("puts Bets without a createdAt last", async () => {
        returnCreated([
            fakeDoc("no-date", betData({ createdAt: undefined })),
            fakeDoc("dated", betData()),
        ]);

        const bets = await getBetsForUser(UID);

        expect(bets.map((bet) => bet.id)).toEqual(["dated", "no-date"]);
    });

    it("sends only the My Bets list fields, never participantUids", async () => {
        returnJoined([
            fakeDoc("joined-bet", betData({
                creatorUid: OTHER_UID,
                participantUids: [OTHER_UID, UID],
                termsAcknowledged: true,
            })),
        ]);

        const [bet] = await getBetsForUser(UID);

        expect(bet).not.toHaveProperty("participantUids");
        expect(bet).not.toHaveProperty("termsAcknowledged");
        expect(bet).not.toHaveProperty("creatorUid");
        expect(JSON.stringify(bet)).not.toContain(OTHER_UID);
    });

    describe("with a limit (SCRUM-106)", () => {
        // The newest three mix created and joined Bets, so limiting each query on its
        // own (instead of after the merge and sort) would return the wrong Bets.
        function returnMixedBets() {
            const joined = (id, iso) => fakeDoc(id, betData({
                creatorUid: OTHER_UID,
                participantUids: [OTHER_UID, UID],
                createdAt: ts(iso),
            }));
            const created = (id, iso) => fakeDoc(id, betData({ createdAt: ts(iso) }));
            returnCreated([
                created("created-1", "2026-10-09T10:00:00.000Z"),
                created("created-2", "2026-10-06T10:00:00.000Z"),
                created("created-3", "2026-10-05T10:00:00.000Z"),
            ]);
            returnJoined([
                joined("joined-1", "2026-10-10T10:00:00.000Z"),
                joined("joined-2", "2026-10-08T10:00:00.000Z"),
            ]);
        }

        it("returns only the newest Bets across created and joined", async () => {
            returnMixedBets();

            const bets = await getBetsForUser(UID, 3);

            expect(bets.map((bet) => bet.id)).toEqual(["joined-1", "created-1", "joined-2"]);
        });

        it("finds the newest Bets even when a query returns more than the limit, out of order", async () => {
            // Firestore doesn't sort these queries, so the newest Bet can come back last.
            // Limiting each query before the merge and sort would drop it.
            returnCreated([
                fakeDoc("middle", betData({ createdAt: ts("2026-10-05T10:00:00.000Z") })),
                fakeDoc("oldest", betData({ createdAt: ts("2026-10-01T10:00:00.000Z") })),
                fakeDoc("newest", betData({ createdAt: ts("2026-10-09T10:00:00.000Z") })),
            ]);

            const bets = await getBetsForUser(UID, 2);

            expect(bets.map((bet) => bet.id)).toEqual(["newest", "middle"]);
        });

        it("returns every Bet when the limit is larger than the list", async () => {
            returnMixedBets();

            const bets = await getBetsForUser(UID, 50);

            expect(bets).toHaveLength(5);
        });

        it("returns every Bet when no limit is given", async () => {
            returnMixedBets();

            const bets = await getBetsForUser(UID);

            expect(bets.map((bet) => bet.id)).toEqual(
                ["joined-1", "created-1", "joined-2", "created-2", "created-3"],
            );
        });

        it("removes duplicates before limiting", async () => {
            const own = fakeDoc("own-bet", betData({ createdAt: ts("2026-10-10T10:00:00.000Z") }));
            returnCreated([own, fakeDoc("older", betData({ createdAt: ts("2026-10-01T10:00:00.000Z") }))]);
            returnJoined([own]);

            const bets = await getBetsForUser(UID, 2);

            expect(bets.map((bet) => bet.id)).toEqual(["own-bet", "older"]);
        });
    });

    it("rejects when either query fails", async () => {
        mockQueryResults.set(JOINED_QUERY, () => Promise.reject(new Error("Firestore unavailable")));

        await expect(getBetsForUser(UID)).rejects.toThrow("Firestore unavailable");
    });
});
