const { FieldValue, Timestamp } = require("firebase-admin/firestore");

// Named createBetService.test.js (not betService.test.js) so it doesn't collide with the
// listing tests being added in SCRUM-31.

const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn();
const mockBetGet = jest.fn();
const mockParticipantDoc = jest.fn();
const mockBetCollectionDoc = jest.fn();
const mockCollection = jest.fn();

const participantRef = { path: "bets/generated-bet-id/participants/creator-uid" };
const participantsCollection = { doc: (...args) => mockParticipantDoc(...args) };
const betRef = {
    id: "generated-bet-id",
    collection: jest.fn(() => participantsCollection),
    get: (...args) => mockBetGet(...args),
};

jest.mock("../src/config/firebaseAdmin", () => ({
    db: {
        collection: (...args) => mockCollection(...args),
        batch: () => ({ set: mockBatchSet, commit: mockBatchCommit }),
    },
}));

const { createBet } = require("../src/services/betService");

const deadline = new Date("2026-11-01T18:00:00.000Z");
const outcomeDeadline = new Date("2026-11-02T18:00:00.000Z");

function validInput(overrides = {}) {
    return {
        title: "Will the Dodgers win on Friday?",
        description: "Friendly wager on Friday's game.",
        outcomeA: "Dodgers win",
        outcomeB: "Dodgers lose",
        creatorUid: "creator-uid",
        creatorSide: "A",
        deadline,
        outcomeDeadline,
        visibility: "public",
        resolutionMethod: "external",
        stakeType: "monetary",
        stakeAmountCents: 1000,
        currency: "USD",
        ...overrides,
    };
}

// Returns the data passed to batch.set() for a given document reference.
function dataWrittenTo(ref) {
    const call = mockBatchSet.mock.calls.find(([writtenRef]) => writtenRef === ref);
    return call?.[1];
}

describe("betService.createBet", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCollection.mockReturnValue({ doc: mockBetCollectionDoc });
        mockBetCollectionDoc.mockReturnValue(betRef);
        mockParticipantDoc.mockReturnValue(participantRef);
        mockBatchCommit.mockResolvedValue(undefined);
        mockBetGet.mockResolvedValue({ data: () => ({ title: "Will the Dodgers win on Friday?" }) });
    });

    it("writes the Bet and the creator's participant record in a single batch", async () => {
        await createBet(validInput());

        expect(mockCollection).toHaveBeenCalledWith("bets");
        expect(betRef.collection).toHaveBeenCalledWith("participants");
        expect(mockParticipantDoc).toHaveBeenCalledWith("creator-uid");
        expect(mockBatchSet).toHaveBeenCalledTimes(2);
        expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it("stores outcomes, both deadlines, and creatorSide on the Bet", async () => {
        await createBet(validInput());

        const bet = dataWrittenTo(betRef);
        expect(bet).toMatchObject({
            outcomeA: "Dodgers win",
            outcomeB: "Dodgers lose",
            creatorSide: "A",
            status: "draft",
        });
        expect(bet.deadline).toEqual(Timestamp.fromDate(deadline));
        expect(bet.outcomeDeadline).toEqual(Timestamp.fromDate(outcomeDeadline));
        expect(bet.createdAt).toEqual(FieldValue.serverTimestamp());
    });

    it("counts the creator as participant #1 on side A", async () => {
        await createBet(validInput({ creatorSide: "A" }));

        expect(dataWrittenTo(betRef)).toMatchObject({
            participantUids: ["creator-uid"],
            participantCount: 1,
            sideACount: 1,
            sideBCount: 0,
        });
    });

    it("counts the creator as participant #1 on side B", async () => {
        await createBet(validInput({ creatorSide: "B" }));

        expect(dataWrittenTo(betRef)).toMatchObject({
            participantUids: ["creator-uid"],
            participantCount: 1,
            sideACount: 0,
            sideBCount: 1,
        });
    });

    it("writes the creator participant record with role, side, terms, and a server timestamp", async () => {
        await createBet(validInput({ creatorSide: "B" }));

        expect(dataWrittenTo(participantRef)).toEqual({
            uid: "creator-uid",
            side: "B",
            role: "creator",
            termsAcknowledged: true,
            joinedAt: FieldValue.serverTimestamp(),
        });
    });

    it("only stores the stake fields that match the stake type", async () => {
        await createBet(validInput({
            stakeType: "nonMonetary",
            stakeAmountCents: undefined,
            currency: undefined,
            stakeDescription: "Loser buys dinner",
        }));

        const bet = dataWrittenTo(betRef);
        expect(bet.stakeDescription).toBe("Loser buys dinner");
        expect(bet).not.toHaveProperty("stakeAmountCents");
        expect(bet).not.toHaveProperty("currency");
    });

    it("returns the saved Bet with its generated id after the batch commits", async () => {
        const result = await createBet(validInput());

        expect(mockBetGet).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ id: "generated-bet-id", title: "Will the Dodgers win on Friday?" });
    });

    it("propagates a failed commit and does not re-read the Bet", async () => {
        mockBatchCommit.mockRejectedValue(new Error("Firestore is down"));

        await expect(createBet(validInput())).rejects.toThrow("Firestore is down");
        expect(mockBetGet).not.toHaveBeenCalled();
    });
});
