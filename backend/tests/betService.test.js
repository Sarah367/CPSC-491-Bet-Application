const { Timestamp } = require("firebase-admin/firestore");

const mockGet = jest.fn();
const mockWhere = jest.fn(() => ({ get: mockGet }));
const mockCollection = jest.fn(() => ({ where: mockWhere, doc: (uid) => ({ id: uid }) }));
// SCRUM-87: Public Bets looks up creator names with one profile read and one Auth lookup.
const mockGetAll = jest.fn();
const mockGetUsers = jest.fn();

jest.mock("../src/config/firebaseAdmin", () => ({
    db: {
        collection: (...args) => mockCollection(...args),
        getAll: (...args) => mockGetAll(...args),
    },
    auth: {
        getUsers: (...args) => mockGetUsers(...args),
    },
}));

const { listPublicBets } = require("../src/services/betService");

function fakeDoc(id, data) {
    return { id, data: () => data };
}

describe("listPublicBets", () => {
    beforeEach(() => {
        mockCollection.mockClear();
        mockWhere.mockClear();
        mockGet.mockReset();
        // By default, nobody has a profile or a Firebase Auth name.
        mockGetAll.mockReset();
        mockGetAll.mockImplementation((...refs) => {
            const docs = [];
            for (const ref of refs) {
                docs.push({ id: ref.id, exists: false });
            }
            return Promise.resolve(docs);
        });
        mockGetUsers.mockReset();
        mockGetUsers.mockResolvedValue({ users: [], notFound: [] });
    });

    it("queries the bets collection filtered to public visibility", async () => {
        mockGet.mockResolvedValue({ docs: [] });

        await listPublicBets();

        expect(mockCollection).toHaveBeenCalledWith("bets");
        expect(mockWhere).toHaveBeenCalledWith("visibility", "==", "public");
    });

    it("serializes each doc's id, converts Timestamps to ISO strings, and sorts newest first", async () => {
        const older = fakeDoc("older-id", {
            title: "Older bet",
            deadline: Timestamp.fromDate(new Date("2026-06-01T00:00:00.000Z")),
            visibility: "public",
            status: "active",
            creatorUid: "uid-1",
            createdAt: Timestamp.fromDate(new Date("2026-01-01T00:00:00.000Z")),
        });
        const newer = fakeDoc("newer-id", {
            title: "Newer bet",
            deadline: Timestamp.fromDate(new Date("2026-07-01T00:00:00.000Z")),
            visibility: "public",
            status: "draft",
            creatorUid: "uid-2",
            createdAt: Timestamp.fromDate(new Date("2026-02-01T00:00:00.000Z")),
        });
        mockGet.mockResolvedValue({ docs: [older, newer] });

        const bets = await listPublicBets();

        expect(bets).toEqual([
            {
                id: "newer-id",
                title: "Newer bet",
                deadline: "2026-07-01T00:00:00.000Z",
                visibility: "public",
                status: "draft",
                creatorUid: "uid-2",
                createdAt: "2026-02-01T00:00:00.000Z",
                creatorDisplayName: null,
            },
            {
                id: "older-id",
                title: "Older bet",
                deadline: "2026-06-01T00:00:00.000Z",
                visibility: "public",
                status: "active",
                creatorUid: "uid-1",
                createdAt: "2026-01-01T00:00:00.000Z",
                creatorDisplayName: null,
            },
        ]);
    });

    it("returns an empty array when there are no public bets", async () => {
        mockGet.mockResolvedValue({ docs: [] });

        const bets = await listPublicBets();

        expect(bets).toEqual([]);
        // With no Bets, there are no names to look up.
        expect(mockGetAll).not.toHaveBeenCalled();
        expect(mockGetUsers).not.toHaveBeenCalled();
    });

    // SCRUM-87
    it("adds each creator's display name, looked up once per creator, not once per Bet", async () => {
        function publicBet(id, creatorUid) {
            return fakeDoc(id, {
                title: id,
                deadline: Timestamp.fromDate(new Date("2026-12-01T00:00:00.000Z")),
                visibility: "public",
                status: "draft",
                creatorUid: creatorUid,
                createdAt: Timestamp.fromDate(new Date("2026-11-01T00:00:00.000Z")),
            });
        }
        mockGet.mockResolvedValue({
            docs: [
                publicBet("bet-1", "with-profile"),
                publicBet("bet-2", "with-profile"),
                publicBet("bet-3", "older-account"),
                publicBet("bet-4", "no-name"),
            ],
        });
        mockGetAll.mockImplementation((...refs) => {
            const docs = [];
            for (const ref of refs) {
                if (ref.id === "with-profile") {
                    docs.push({ id: ref.id, exists: true, data: () => ({ displayName: "Jordan Rivera" }) });
                } else {
                    docs.push({ id: ref.id, exists: false });
                }
            }
            return Promise.resolve(docs);
        });
        mockGetUsers.mockResolvedValue({
            users: [{ uid: "older-account", displayName: "Sam Lee" }],
            notFound: [],
        });

        const bets = await listPublicBets();

        const namesByBet = {};
        for (const bet of bets) {
            namesByBet[bet.id] = bet.creatorDisplayName;
        }
        expect(namesByBet).toEqual({
            "bet-1": "Jordan Rivera",
            "bet-2": "Jordan Rivera",
            "bet-3": "Sam Lee",
            "bet-4": null,
        });

        // One profile read for the 3 distinct creators, and one Auth lookup for the 2
        // without a profile name.
        expect(mockGetAll).toHaveBeenCalledTimes(1);
        expect(mockGetAll.mock.calls[0]).toHaveLength(3);
        expect(mockGetUsers).toHaveBeenCalledTimes(1);
        expect(mockGetUsers).toHaveBeenCalledWith([{ uid: "older-account" }, { uid: "no-name" }]);
    });
});
