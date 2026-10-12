// Mock the Firebase Admin config so no real credentials or network are needed.
// The query chain records the where() filter so the test can assert on it.
const mockWhere = jest.fn();
const mockGet = jest.fn();

jest.mock("../src/config/firebaseAdmin", () => ({
    db: {
        collection: jest.fn(() => ({ where: mockWhere })),
    },
}));

const { Timestamp } = require("firebase-admin/firestore");
const { db } = require("../src/config/firebaseAdmin");
const { getBetsByCreator } = require("../src/services/betService");

function fakeDoc(id, data) {
    return { id, data: () => data };
}

describe("getBetsByCreator", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockWhere.mockReturnValue({ get: mockGet });
    });

    it("queries the bets collection filtered by creatorUid only", async () => {
        mockGet.mockResolvedValue({ docs: [] });

        await getBetsByCreator("user-a");

        expect(db.collection).toHaveBeenCalledWith("bets");
        expect(mockWhere).toHaveBeenCalledTimes(1);
        expect(mockWhere).toHaveBeenCalledWith("creatorUid", "==", "user-a");
    });

    it("returns an empty array when the user has no bets", async () => {
        mockGet.mockResolvedValue({ docs: [] });

        await expect(getBetsByCreator("user-a")).resolves.toEqual([]);
    });

    it("converts Timestamps to ISO strings and sorts newest first", async () => {
        const older = new Date("2026-09-01T10:00:00.000Z");
        const newer = new Date("2026-09-20T10:00:00.000Z");
        const deadline = new Date("2026-10-01T00:00:00.000Z");

        mockGet.mockResolvedValue({
            docs: [
                fakeDoc("older-bet", {
                    title: "Older",
                    creatorUid: "user-a",
                    createdAt: Timestamp.fromDate(older),
                    deadline: Timestamp.fromDate(deadline),
                }),
                fakeDoc("newer-bet", {
                    title: "Newer",
                    creatorUid: "user-a",
                    createdAt: Timestamp.fromDate(newer),
                    deadline: Timestamp.fromDate(deadline),
                }),
            ],
        });

        const bets = await getBetsByCreator("user-a");

        expect(bets.map((bet) => bet.id)).toEqual(["newer-bet", "older-bet"]);
        expect(bets[0]).toEqual({
            id: "newer-bet",
            title: "Newer",
            creatorUid: "user-a",
            createdAt: newer.toISOString(),
            deadline: deadline.toISOString(),
        });
    });
});
