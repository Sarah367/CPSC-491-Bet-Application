const { Timestamp } = require("firebase-admin/firestore");

const mockGet = jest.fn();
const mockDoc = jest.fn(() => ({ get: mockGet }));
const mockCollection = jest.fn(() => ({ doc: mockDoc }));
const mockGetUser = jest.fn();

jest.mock("../src/config/firebaseAdmin", () => ({
    db: {
        collection: (...args) => mockCollection(...args),
    },
    auth: {
        getUser: (...args) => mockGetUser(...args),
    },
}));

const { getBetById } = require("../src/services/betService");

function fakeDoc(id, data, exists = true) {
    return { id, exists, data: () => data };
}

describe("getBetById service", () => {
    beforeEach(() => {
        mockCollection.mockClear();
        mockDoc.mockClear();
        mockGet.mockReset();
        mockGetUser.mockReset();
    });

    it("looks up the bet by id in the bets collection", async () => {
        mockGet.mockResolvedValue(fakeDoc("bet-1", { title: "Test bet", creatorUid: "creator-uid" }));
        mockGetUser.mockResolvedValue({ displayName: "Jordan Rivera" });

        await getBetById("bet-1");

        expect(mockCollection).toHaveBeenCalledWith("bets");
        expect(mockDoc).toHaveBeenCalledWith("bet-1");
    });

    it("serializes the doc, converts Timestamps to ISO strings, and adds creatorDisplayName", async () => {
        mockGet.mockResolvedValue(
            fakeDoc("bet-1", {
                title: "Will the Dodgers win on Friday?",
                description: "Friendly wager.",
                creatorUid: "creator-uid",
                visibility: "public",
                resolutionMethod: "external",
                status: "active",
                deadline: Timestamp.fromDate(new Date("2026-07-01T00:00:00.000Z")),
                createdAt: Timestamp.fromDate(new Date("2026-01-01T00:00:00.000Z")),
            })
        );
        mockGetUser.mockResolvedValue({ displayName: "Jordan Rivera" });

        const bet = await getBetById("bet-1");

        expect(bet).toEqual({
            id: "bet-1",
            title: "Will the Dodgers win on Friday?",
            description: "Friendly wager.",
            creatorUid: "creator-uid",
            visibility: "public",
            resolutionMethod: "external",
            status: "active",
            deadline: "2026-07-01T00:00:00.000Z",
            createdAt: "2026-01-01T00:00:00.000Z",
            creatorDisplayName: "Jordan Rivera",
        });
        expect(mockGetUser).toHaveBeenCalledWith("creator-uid");
    });

    it("returns null when the bet doesn't exist, without looking up a display name", async () => {
        mockGet.mockResolvedValue(fakeDoc("missing-id", undefined, false));

        const bet = await getBetById("missing-id");

        expect(bet).toBeNull();
        expect(mockGetUser).not.toHaveBeenCalled();
    });

    it("sets creatorDisplayName to null when the user has no displayName set", async () => {
        mockGet.mockResolvedValue(fakeDoc("bet-1", { title: "Test bet", creatorUid: "creator-uid" }));
        mockGetUser.mockResolvedValue({ displayName: undefined });

        const bet = await getBetById("bet-1");

        expect(bet.creatorDisplayName).toBeNull();
    });

    it("sets creatorDisplayName to null (not email/uid) and still returns 200-worthy data when auth.getUser rejects", async () => {
        mockGet.mockResolvedValue(fakeDoc("bet-1", { title: "Test bet", creatorUid: "creator-uid" }));
        mockGetUser.mockRejectedValue(new Error("user-not-found"));
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        const bet = await getBetById("bet-1");

        expect(bet).toEqual(
            expect.objectContaining({ id: "bet-1", creatorUid: "creator-uid", creatorDisplayName: null })
        );

        consoleErrorSpy.mockRestore();
    });
});
