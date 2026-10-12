const { Timestamp } = require("firebase-admin/firestore");

const mockGet = jest.fn();
const mockWhere = jest.fn(() => ({ get: mockGet }));
const mockCollection = jest.fn(() => ({ where: mockWhere }));

jest.mock("../src/config/firebaseAdmin", () => ({
    db: {
        collection: (...args) => mockCollection(...args),
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
            },
            {
                id: "older-id",
                title: "Older bet",
                deadline: "2026-06-01T00:00:00.000Z",
                visibility: "public",
                status: "active",
                creatorUid: "uid-1",
                createdAt: "2026-01-01T00:00:00.000Z",
            },
        ]);
    });

    it("returns an empty array when there are no public bets", async () => {
        mockGet.mockResolvedValue({ docs: [] });

        const bets = await listPublicBets();

        expect(bets).toEqual([]);
    });
});
