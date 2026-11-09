const { Timestamp } = require("firebase-admin/firestore");
const { serializeMyBet, MY_BET_FIELDS } = require("../src/serializers/myBetsSerializer");

const VIEWER_UID = "viewer-uid";
const OTHER_UID = "other-uid";

function ts(iso) {
    return Timestamp.fromDate(new Date(iso));
}

function fakeDoc(id, data) {
    return { id, data: () => data };
}

// A full stored Bet, including fields that must never reach the client.
function storedBet(overrides = {}) {
    return {
        title: "Will it rain on Friday?",
        description: "Friendly weather bet.",
        outcomeA: "Rain",
        outcomeB: "No rain",
        creatorUid: VIEWER_UID,
        creatorSide: "A",
        visibility: "public",
        resolutionMethod: "external",
        status: "draft",
        stakeType: "monetary",
        stakeAmountCents: 500,
        currency: "USD",
        termsAcknowledged: true,
        participantUids: [VIEWER_UID, OTHER_UID],
        participantCount: 2,
        sideACount: 1,
        sideBCount: 1,
        deadline: ts("2026-11-20T18:00:00.000Z"),
        outcomeDeadline: ts("2026-11-21T18:00:00.000Z"),
        createdAt: ts("2026-10-08T10:00:00.000Z"),
        internalOnlyField: "never send this",
        ...overrides,
    };
}

describe("serializeMyBet", () => {
    it("returns only the allowlisted fields for a monetary Bet", () => {
        const bet = serializeMyBet(fakeDoc("bet-1", storedBet()), VIEWER_UID);

        expect(bet).toEqual({
            id: "bet-1",
            title: "Will it rain on Friday?",
            status: "draft",
            visibility: "public",
            stakeType: "monetary",
            stakeAmountCents: 500,
            currency: "USD",
            deadline: "2026-11-20T18:00:00.000Z",
            createdAt: "2026-10-08T10:00:00.000Z",
            viewerRole: "creator",
        });
    });

    it("returns stakeDescription for a non-monetary Bet", () => {
        const bet = serializeMyBet(
            fakeDoc("bet-2", storedBet({
                stakeType: "nonMonetary",
                stakeAmountCents: undefined,
                currency: undefined,
                stakeDescription: "Loser buys dinner",
            })),
            VIEWER_UID,
        );

        expect(bet.stakeType).toBe("nonMonetary");
        expect(bet.stakeDescription).toBe("Loser buys dinner");
        expect(bet).not.toHaveProperty("stakeAmountCents");
        expect(bet).not.toHaveProperty("currency");
    });

    it("never sends participantUids, termsAcknowledged, creatorUid, or unknown fields", () => {
        const bet = serializeMyBet(fakeDoc("bet-1", storedBet()), VIEWER_UID);

        for (const field of [
            "participantUids",
            "termsAcknowledged",
            "creatorUid",
            "internalOnlyField",
            "outcomeA",
            "participantCount",
        ]) {
            expect(bet).not.toHaveProperty(field);
        }
        expect(JSON.stringify(bet)).not.toContain(OTHER_UID);
    });

    it("labels the viewer as the creator of their own Bet", () => {
        const bet = serializeMyBet(fakeDoc("bet-1", storedBet()), VIEWER_UID);

        expect(bet.viewerRole).toBe("creator");
    });

    it("labels the viewer as a participant in someone else's Bet", () => {
        const bet = serializeMyBet(
            fakeDoc("bet-1", storedBet({ creatorUid: OTHER_UID })),
            VIEWER_UID,
        );

        expect(bet.viewerRole).toBe("participant");
    });

    it("returns null dates when a Bet is missing them", () => {
        const bet = serializeMyBet(
            fakeDoc("bet-1", storedBet({ deadline: undefined, createdAt: undefined })),
            VIEWER_UID,
        );

        expect(bet.deadline).toBeNull();
        expect(bet.createdAt).toBeNull();
    });

    it("exports a frozen field list", () => {
        expect(Object.isFrozen(MY_BET_FIELDS)).toBe(true);
    });
});