const { FieldValue, Timestamp } = require("firebase-admin/firestore");

// Fake Firestore. The transaction records every read and write, so tests can check that
// rejected edits never write anything, and that reads happen before writes.
const mockCalls = [];
const mockTransaction = {
    get: jest.fn((ref) => {
        mockCalls.push(`get:${ref.path}`);
        return ref === mockBetRef ? mockBetSnapshot() : mockParticipantSnapshot();
    }),
    update: jest.fn((ref) => {
        mockCalls.push(`update:${ref.path}`);
    }),
};
const mockParticipantRef = { path: "bets/bet-1/participants/creator-uid" };
const mockBetRef = {
    path: "bets/bet-1",
    collection: () => ({ doc: () => mockParticipantRef }),
};
let mockStoredBet;
let mockParticipantExists;
function mockBetSnapshot() {
    return { exists: mockStoredBet !== undefined, data: () => mockStoredBet };
}
function mockParticipantSnapshot() {
    return { exists: mockParticipantExists, data: () => ({ side: "A" }) };
}

jest.mock("../src/config/firebaseAdmin", () => ({
    db: {
        collection: () => ({ doc: () => mockBetRef }),
        runTransaction: (callback) => callback(mockTransaction),
    },
    auth: { getUser: jest.fn() },
}));

const { updateBet } = require("../src/services/betService");
const { BetEditError, EDIT_ERROR } = require("../src/errors/betEditError");

const DAY_MS = 24 * 60 * 60 * 1000;
const CREATOR = "creator-uid";

// A Draft Bet that only its creator (on side A) has joined, with joining still open.
function storedBet(overrides = {}) {
    return {
        title: "Will it rain this weekend?",
        description: "Friendly weather bet.",
        outcomeA: "Rain",
        outcomeB: "No rain",
        creatorUid: CREATOR,
        creatorSide: "A",
        visibility: "public",
        resolutionMethod: "personal",
        status: "draft",
        deadline: Timestamp.fromDate(new Date(Date.now() + DAY_MS)),
        outcomeDeadline: Timestamp.fromDate(new Date(Date.now() + 2 * DAY_MS)),
        stakeType: "nonMonetary",
        stakeDescription: "Loser buys coffee",
        participantUids: [CREATOR],
        participantCount: 1,
        sideACount: 1,
        sideBCount: 0,
        ...overrides,
    };
}

function betUpdates() {
    const call = mockTransaction.update.mock.calls.find(([ref]) => ref === mockBetRef);
    return call ? call[1] : undefined;
}

async function expectEditError(code, changes = { title: "New title" }, uid = CREATOR) {
    const error = await updateBet("bet-1", uid, changes).catch((e) => e);
    expect(error).toBeInstanceOf(BetEditError);
    expect(error.code).toBe(code);
    // A rejected edit never writes anything.
    expect(mockTransaction.update).not.toHaveBeenCalled();
    return error;
}

beforeEach(() => {
    jest.clearAllMocks();
    mockCalls.length = 0;
    mockStoredBet = storedBet();
    mockParticipantExists = true;
});

describe("updateBet service: successful edits", () => {
    it("reads the Bet and the creator's participant record before writing", async () => {
        await updateBet("bet-1", CREATOR, { title: "New title" });

        expect(mockCalls.slice(0, 2)).toEqual([
            "get:bets/bet-1",
            "get:bets/bet-1/participants/creator-uid",
        ]);
        expect(mockCalls.slice(2).every((call) => call.startsWith("update:"))).toBe(true);
    });

    it("saves a single changed field, keeping the others, and trims text", async () => {
        await updateBet("bet-1", CREATOR, { title: "  New title  " });

        expect(betUpdates()).toMatchObject({
            title: "New title",
            description: "Friendly weather bet.",
            outcomeA: "Rain",
            outcomeB: "No rain",
            updatedAt: FieldValue.serverTimestamp(),
        });
    });

    it("saves several changed fields at once", async () => {
        const deadline = new Date(Date.now() + 3 * DAY_MS).toISOString();
        const outcomeDeadline = new Date(Date.now() + 4 * DAY_MS).toISOString();

        await updateBet("bet-1", CREATOR, {
            outcomeA: "Sunny",
            outcomeB: "Cloudy",
            visibility: "private",
            deadline,
            outcomeDeadline,
        });

        expect(betUpdates()).toMatchObject({
            outcomeA: "Sunny",
            outcomeB: "Cloudy",
            visibility: "private",
            deadline: Timestamp.fromDate(new Date(deadline)),
            outcomeDeadline: Timestamp.fromDate(new Date(outcomeDeadline)),
        });
    });

    it("switching to a monetary stake stores the amount and removes the description", async () => {
        await updateBet("bet-1", CREATOR, { stakeType: "monetary", stakeAmountCents: 500, currency: "USD" });

        expect(betUpdates()).toMatchObject({
            stakeType: "monetary",
            stakeAmountCents: 500,
            currency: "USD",
            stakeDescription: FieldValue.delete(),
        });
    });

    it("switching to a non-monetary stake removes the amount and currency", async () => {
        mockStoredBet = storedBet({
            stakeType: "monetary",
            stakeAmountCents: 500,
            currency: "USD",
            stakeDescription: undefined,
        });

        await updateBet("bet-1", CREATOR, { stakeType: "nonMonetary", stakeDescription: "Loser buys lunch" });

        expect(betUpdates()).toMatchObject({
            stakeType: "nonMonetary",
            stakeDescription: "Loser buys lunch",
            stakeAmountCents: FieldValue.delete(),
            currency: FieldValue.delete(),
        });
    });

    it("never changes the status, creator, or participant list", async () => {
        await updateBet("bet-1", CREATOR, { title: "New title" });

        expect(betUpdates()).not.toHaveProperty("status");
        expect(betUpdates()).not.toHaveProperty("creatorUid");
        expect(betUpdates()).not.toHaveProperty("participantUids");
        expect(betUpdates()).not.toHaveProperty("participantCount");
    });
});

describe("updateBet service: changing the creator's side", () => {
    it("moves the creator from A to B, updating their participant record and the side counts", async () => {
        await updateBet("bet-1", CREATOR, { creatorSide: "B" });

        expect(mockTransaction.update).toHaveBeenCalledWith(mockParticipantRef, { side: "B" });
        expect(betUpdates()).toMatchObject({ creatorSide: "B", sideACount: 0, sideBCount: 1 });
    });

    it("moves the creator from B to A", async () => {
        mockStoredBet = storedBet({ creatorSide: "B", sideACount: 0, sideBCount: 1 });

        await updateBet("bet-1", CREATOR, { creatorSide: "A" });

        expect(mockTransaction.update).toHaveBeenCalledWith(mockParticipantRef, { side: "A" });
        expect(betUpdates()).toMatchObject({ creatorSide: "A", sideACount: 1, sideBCount: 0 });
    });

    it("doesn't touch the participant record or counts when the side doesn't change", async () => {
        await updateBet("bet-1", CREATOR, { creatorSide: "A", title: "New title" });

        expect(mockTransaction.update).toHaveBeenCalledTimes(1);
        expect(betUpdates()).not.toHaveProperty("sideACount");
        expect(betUpdates()).not.toHaveProperty("sideBCount");
    });
});

describe("updateBet service: who can edit, and when", () => {
    it("rejects a Bet that doesn't exist", async () => {
        mockStoredBet = undefined;
        await expectEditError(EDIT_ERROR.NOT_FOUND);
    });

    it("treats someone else's Bet the same as a missing one", async () => {
        await expectEditError(EDIT_ERROR.NOT_FOUND, { title: "New title" }, "someone-else");
    });

    it.each(["active", "locked", "resolved", "archived"])("rejects a Bet with status %s", async (status) => {
        mockStoredBet = storedBet({ status });
        await expectEditError(EDIT_ERROR.NOT_EDITABLE);
    });

    it("rejects a Draft that someone else has joined, even on the creator's side", async () => {
        mockStoredBet = storedBet({
            participantUids: [CREATOR, "joiner-uid"],
            participantCount: 2,
            sideACount: 2,
        });
        await expectEditError(EDIT_ERROR.NOT_EDITABLE);
    });

    it("rejects a Bet whose participant list doesn't match a count of 1", async () => {
        mockStoredBet = storedBet({ participantUids: [CREATOR, "joiner-uid"], participantCount: 1 });
        await expectEditError(EDIT_ERROR.NOT_EDITABLE);
    });

    it("rejects a Bet whose deadline has passed, even if the edit moves it later", async () => {
        mockStoredBet = storedBet({ deadline: Timestamp.fromDate(new Date(Date.now() - 1000)) });
        await expectEditError(EDIT_ERROR.NOT_EDITABLE, {
            deadline: new Date(Date.now() + DAY_MS).toISOString(),
        });
    });

    it("rejects a Bet at exactly its deadline", async () => {
        const now = Date.now();
        jest.spyOn(Date, "now").mockReturnValue(now);
        mockStoredBet = storedBet({ deadline: Timestamp.fromMillis(now) });

        await expectEditError(EDIT_ERROR.NOT_EDITABLE);

        Date.now.mockRestore();
    });

    it("rejects a Bet with a missing deadline instead of allowing the edit", async () => {
        mockStoredBet = storedBet({ deadline: undefined });
        await expectEditError(EDIT_ERROR.NOT_EDITABLE);
    });
});

describe("updateBet service: the edited Bet must still follow the Create Bet rules", () => {
    it("rejects a new deadline that lands after the existing outcome deadline", async () => {
        const error = await expectEditError(EDIT_ERROR.INVALID, {
            deadline: new Date(Date.now() + 3 * DAY_MS).toISOString(),
        });
        expect(error.message).toBe("outcomeDeadline must be after deadline.");
    });

    it("rejects an outcome that matches the other one after trimming and ignoring case", async () => {
        const error = await expectEditError(EDIT_ERROR.INVALID, { outcomeA: "  no RAIN " });
        expect(error.message).toBe("outcomeA and outcomeB must be different.");
    });

    it("rejects switching to a monetary stake without an amount", async () => {
        const error = await expectEditError(EDIT_ERROR.INVALID, { stakeType: "monetary", currency: "USD" });
        expect(error.message).toMatch(/stakeAmountCents/);
    });

    it("rejects an unsupported currency", async () => {
        const error = await expectEditError(EDIT_ERROR.INVALID, {
            stakeType: "monetary",
            stakeAmountCents: 500,
            currency: "EUR",
        });
        expect(error.message).toBe("currency must be one of: USD.");
    });

    it("rejects a blank title", async () => {
        const error = await expectEditError(EDIT_ERROR.INVALID, { title: "   " });
        expect(error.message).toBe("title is required.");
    });
});

describe("updateBet service: errors", () => {
    it("passes unexpected Firestore errors through, without writing", async () => {
        mockTransaction.get.mockRejectedValueOnce(new Error("Firestore unavailable"));

        await expect(updateBet("bet-1", CREATOR, { title: "New title" })).rejects.toThrow("Firestore unavailable");
        expect(mockTransaction.update).not.toHaveBeenCalled();
    });
});
