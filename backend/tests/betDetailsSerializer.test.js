const { serializeBetDetails, BET_DETAILS_FIELDS } = require("../src/serializers/betDetailsSerializer");

function storedBet(overrides = {}) {
    return {
        id: "bet-1",
        title: "Will it rain this weekend?",
        description: "Friendly weather bet.",
        outcomeA: "Rain",
        outcomeB: "No rain",
        creatorUid: "creator-uid",
        creatorDisplayName: "Sarah",
        creatorSide: "A",
        deadline: "2026-11-01T18:00:00.000Z",
        outcomeDeadline: "2026-11-02T18:00:00.000Z",
        createdAt: "2026-10-20T18:00:00.000Z",
        visibility: "public",
        resolutionMethod: "personal",
        status: "active",
        participantCount: 2,
        sideACount: 1,
        sideBCount: 1,
        participantUids: ["creator-uid", "joiner-uid"],
        termsAcknowledged: true,
        stakeType: "monetary",
        stakeAmountCents: 500,
        currency: "USD",
        ...overrides,
    };
}

describe("serializeBetDetails", () => {
    it("keeps every allowlisted field that's set", () => {
        const details = serializeBetDetails(storedBet());

        expect(details).toEqual({
            id: "bet-1",
            title: "Will it rain this weekend?",
            description: "Friendly weather bet.",
            outcomeA: "Rain",
            outcomeB: "No rain",
            creatorUid: "creator-uid",
            creatorDisplayName: "Sarah",
            creatorSide: "A",
            deadline: "2026-11-01T18:00:00.000Z",
            outcomeDeadline: "2026-11-02T18:00:00.000Z",
            visibility: "public",
            resolutionMethod: "personal",
            status: "active",
            participantCount: 2,
            sideACount: 1,
            sideBCount: 1,
            stakeType: "monetary",
            stakeAmountCents: 500,
            currency: "USD",
        });
    });

    it.each(["participantUids", "termsAcknowledged", "createdAt"])("leaves out %s", (field) => {
        expect(serializeBetDetails(storedBet())).not.toHaveProperty(field);
    });

    it("leaves out any field that isn't on the allowlist, including new ones", () => {
        const details = serializeBetDetails(storedBet({ internalOnlyField: "secret", anotherNewField: 42 }));

        expect(details).not.toHaveProperty("internalOnlyField");
        expect(details).not.toHaveProperty("anotherNewField");
    });

    it("includes stakeDescription instead of an amount for a non-monetary Bet", () => {
        const details = serializeBetDetails(
            storedBet({
                stakeType: "non_monetary",
                stakeAmountCents: undefined,
                currency: undefined,
                stakeDescription: "Loser buys coffee",
            })
        );

        expect(details).toMatchObject({ stakeType: "non_monetary", stakeDescription: "Loser buys coffee" });
        expect(details).not.toHaveProperty("stakeAmountCents");
        expect(details).not.toHaveProperty("currency");
    });

    it("keeps a creatorDisplayName of null, since that means the lookup failed", () => {
        expect(serializeBetDetails(storedBet({ creatorDisplayName: null })).creatorDisplayName).toBeNull();
    });

    it("doesn't change the original Bet object", () => {
        const bet = storedBet();
        serializeBetDetails(bet);
        expect(bet).toHaveProperty("participantUids");
    });

    it("has a frozen allowlist that can't be changed at runtime", () => {
        expect(Object.isFrozen(BET_DETAILS_FIELDS)).toBe(true);
        expect(BET_DETAILS_FIELDS).not.toContain("participantUids");
    });
});
