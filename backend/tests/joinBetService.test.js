const { FieldValue, Timestamp } = require("firebase-admin/firestore");
 
// Fake Firestore pieces. The transaction records every read and write so tests can
// check that rejected joins never write anything.
const mockTransaction = {
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
};
const mockParticipantRef = { path: "bets/bet-1/participants/joiner-uid" };
const mockParticipantGet = jest.fn();
const mockBetGet = jest.fn();
const mockBetRef = {
    path: "bets/bet-1",
    get: (...args) => mockBetGet(...args),
    collection: () => ({
        doc: () => ({ ...mockParticipantRef, get: (...args) => mockParticipantGet(...args) }),
    }),
};
const mockGetUser = jest.fn();
 
jest.mock("../src/config/firebaseAdmin", () => ({
    db: {
        collection: () => ({ doc: () => mockBetRef }),
        runTransaction: (callback) => callback(mockTransaction),
    },
    auth: {
        getUser: (...args) => mockGetUser(...args),
    },
}));
 
const { joinBet, getViewerParticipation } = require("../src/services/betService");
const { BetJoinError, JOIN_ERROR } = require("../src/errors/betJoinError");

const DAY_MS = 24 * 60 * 60 * 1000;
 
function snapshot(data, exists = true) {
    return { id: "bet-1", exists, data: () => data };
}
 
function betData(overrides = {}) {
    return {
        title: "Will it rain this weekend?",
        creatorUid: "creator-uid",
        visibility: "public",
        status: "draft",
        deadline: Timestamp.fromDate(new Date(Date.now() + DAY_MS)),
        participantUids: ["creator-uid"],
        participantCount: 1,
        sideACount: 1,
        sideBCount: 0,
        ...overrides,
    };
}
 
// The transaction reads the Bet first, then the joining user's participant record.
function setUpReads(bet, participantExists = false) {
    mockTransaction.get
        .mockResolvedValueOnce(bet === null ? snapshot(undefined, false) : snapshot(bet))
        .mockResolvedValueOnce(snapshot({ side: "A" }, participantExists));
}
 
async function expectJoinError(code) {
    const error = await joinBet("bet-1", "joiner-uid", "A").catch((e) => e);
    expect(error).toBeInstanceOf(BetJoinError);
    expect(error.code).toBe(code);
    // A rejected join never writes anything.
    expect(mockTransaction.set).not.toHaveBeenCalled();
    expect(mockTransaction.update).not.toHaveBeenCalled();
}

describe("joinBet service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockTransaction.get.mockReset();
        // joinBet returns the updated Bet by re-reading it after the transaction.
        mockBetGet.mockResolvedValue(snapshot(betData({ participantCount: 2 })));
        mockGetUser.mockResolvedValue({ displayName: "Creator" });
    });
 
    it("reads the Bet and the participant record before writing", async () => {
        setUpReads(betData());
 
        await joinBet("bet-1", "joiner-uid", "A");
 
        expect(mockTransaction.get).toHaveBeenNthCalledWith(1, mockBetRef);
        expect(mockTransaction.get.mock.calls[1][0].path).toBe(mockParticipantRef.path);
    });
 
    it("creates the participant record and updates side A's counts", async () => {
        setUpReads(betData());
 
        await joinBet("bet-1", "joiner-uid", "A");
 
        expect(mockTransaction.set).toHaveBeenCalledTimes(1);
        expect(mockTransaction.set.mock.calls[0][1]).toEqual({
            uid: "joiner-uid",
            side: "A",
            role: "participant",
            termsAcknowledged: true,
            joinedAt: FieldValue.serverTimestamp(),
        });
        expect(mockTransaction.update).toHaveBeenCalledWith(mockBetRef, {
            participantUids: FieldValue.arrayUnion("joiner-uid"),
            participantCount: FieldValue.increment(1),
            sideACount: FieldValue.increment(1),
        });
    });
 
    it("increments sideBCount when joining side B", async () => {
        setUpReads(betData());
 
        await joinBet("bet-1", "joiner-uid", "B");
 
        const updates = mockTransaction.update.mock.calls[0][1];
        expect(updates.sideBCount).toEqual(FieldValue.increment(1));
        expect(updates).not.toHaveProperty("sideACount");
    });
 
    it("keeps a Draft as a Draft when the joiner picks the creator's side", async () => {
        setUpReads(betData());
 
        await joinBet("bet-1", "joiner-uid", "A");
 
        expect(mockTransaction.update.mock.calls[0][1]).not.toHaveProperty("status");
    });
 
    it("allows joining an Active Bet", async () => {
        setUpReads(betData({ status: "active" }));
 
        await joinBet("bet-1", "joiner-uid", "A");
 
        expect(mockTransaction.set).toHaveBeenCalledTimes(1);
    });
 
    it("returns the updated Bet", async () => {
        setUpReads(betData());
 
        const bet = await joinBet("bet-1", "joiner-uid", "A");
 
        expect(bet).toMatchObject({ id: "bet-1", participantCount: 2 });
    });

    it("rejects a Bet that doesn't exist", async () => {
        setUpReads(null);
        await expectJoinError(JOIN_ERROR.NOT_FOUND);
    });
 
    it("rejects a private Bet the same way as a missing one", async () => {
        setUpReads(betData({ visibility: "private" }));
        await expectJoinError(JOIN_ERROR.NOT_FOUND);
    });
 
    it("rejects the creator", async () => {
        setUpReads(betData({ creatorUid: "joiner-uid" }));
        await expectJoinError(JOIN_ERROR.CREATOR);
    });
 
    it("rejects a user who already joined", async () => {
        setUpReads(betData(), true);
        await expectJoinError(JOIN_ERROR.ALREADY_JOINED);
    });
 
    it.each(["locked", "resolved", "archived"])("rejects a Bet with status %s", async (status) => {
        setUpReads(betData({ status }));
        await expectJoinError(JOIN_ERROR.CLOSED);
    });
 
    it("rejects a Bet whose deadline has passed", async () => {
        setUpReads(betData({ deadline: Timestamp.fromDate(new Date(Date.now() - 1000)) }));
        await expectJoinError(JOIN_ERROR.CLOSED);
    });
 
    it("rejects a Bet at exactly its deadline", async () => {
        const now = Date.now();
        jest.spyOn(Date, "now").mockReturnValue(now);
        setUpReads(betData({ deadline: Timestamp.fromMillis(now) }));
 
        await expectJoinError(JOIN_ERROR.CLOSED);
 
        Date.now.mockRestore();
    });
 
    it("rejects a Bet with a missing deadline instead of allowing the join", async () => {
        setUpReads(betData({ deadline: undefined }));
        await expectJoinError(JOIN_ERROR.CLOSED);
    });
 
    it("passes unexpected Firestore errors through", async () => {
        mockTransaction.get.mockRejectedValue(new Error("Firestore unavailable"));
 
        await expect(joinBet("bet-1", "joiner-uid", "A")).rejects.toThrow("Firestore unavailable");
        expect(mockTransaction.set).not.toHaveBeenCalled();
    });
});

describe("getViewerParticipation service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
 
    it("returns the viewer's side and role when they've joined", async () => {
        mockParticipantGet.mockResolvedValue(
            snapshot({ uid: "joiner-uid", side: "B", role: "participant", termsAcknowledged: true })
        );
 
        await expect(getViewerParticipation("bet-1", "joiner-uid")).resolves.toEqual({
            side: "B",
            role: "participant",
        });
    });
 
    it("returns null when the viewer hasn't joined", async () => {
        mockParticipantGet.mockResolvedValue(snapshot(undefined, false));
 
        await expect(getViewerParticipation("bet-1", "joiner-uid")).resolves.toBeNull();
    });
});

describe("joinBet auto-activation (SCRUM-55)", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockTransaction.get.mockReset();
        mockBetGet.mockResolvedValue(snapshot(betData({ status: "active", participantCount: 2 })));
        mockGetUser.mockResolvedValue({ displayName: "Creator" });
    });
 
    function statusWritten() {
        return mockTransaction.update.mock.calls[0][1].status;
    }

    it("activates the Bet when someone joins the creator's opposite side", async () => {
        setUpReads(betData({ creatorSide: "A", sideACount: 1, sideBCount: 0 }));
 
        await joinBet("bet-1", "joiner-uid", "B");
 
        expect(statusWritten()).toBe("active");
        // The activation is part of the same update as the join, so it all happens together.
        expect(mockTransaction.update).toHaveBeenCalledTimes(1);
        expect(mockTransaction.update.mock.calls[0][1]).toMatchObject({
            participantCount: FieldValue.increment(1),
            sideBCount: FieldValue.increment(1),
            status: "active",
        });
    });
 
    it("works the same when the creator is on side B", async () => {
        setUpReads(betData({ creatorSide: "B", sideACount: 0, sideBCount: 1 }));
 
        await joinBet("bet-1", "joiner-uid", "A");
 
        expect(statusWritten()).toBe("active");
    });

    it("stays a Draft while everyone is on one side, then activates when the other side gets someone", async () => {
        // Two people on side A and nobody on B: joining A again keeps it a Draft.
        setUpReads(betData({ participantCount: 2, sideACount: 2, sideBCount: 0 }));
        await joinBet("bet-1", "third-uid", "A");
        expect(statusWritten()).toBeUndefined();
 
        // Now someone joins B, so both sides have someone.
        jest.clearAllMocks();
        mockTransaction.get.mockReset();
        setUpReads(betData({ participantCount: 3, sideACount: 3, sideBCount: 0 }));
        await joinBet("bet-1", "fourth-uid", "B");
        expect(statusWritten()).toBe("active");
    });
 
    it("doesn't change the status when joining a Bet that is already Active", async () => {
        setUpReads(betData({ status: "active", participantCount: 2, sideACount: 1, sideBCount: 1 }));
 
        await joinBet("bet-1", "joiner-uid", "B");
 
        expect(statusWritten()).toBeUndefined();
        expect(mockTransaction.update.mock.calls[0][1].sideBCount).toEqual(FieldValue.increment(1));
    });

    it("activates a Draft that already had both sides filled, on the next join", async () => {
        setUpReads(betData({ status: "draft", participantCount: 2, sideACount: 1, sideBCount: 1 }));
 
        await joinBet("bet-1", "joiner-uid", "A");
 
        expect(statusWritten()).toBe("active");
    });
 
    it("stays a Draft for an old Bet that is missing its side counts", async () => {
        setUpReads(betData({ sideACount: undefined, sideBCount: undefined }));
 
        await joinBet("bet-1", "joiner-uid", "B");
 
        expect(statusWritten()).toBeUndefined();
    });
 
    it("returns the updated Bet with its new status", async () => {
        setUpReads(betData({ sideACount: 1, sideBCount: 0 }));
 
        const bet = await joinBet("bet-1", "joiner-uid", "B");
 
        expect(bet.status).toBe("active");
    });
 
    it("doesn't activate anything when the join is rejected", async () => {
        setUpReads(betData({ deadline: Timestamp.fromDate(new Date(Date.now() - 1000)), sideBCount: 0 }));
 
        await expect(joinBet("bet-1", "joiner-uid", "B")).rejects.toBeInstanceOf(BetJoinError);
        expect(mockTransaction.update).not.toHaveBeenCalled();
    });
});