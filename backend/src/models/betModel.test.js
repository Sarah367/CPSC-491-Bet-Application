const {
    BET_COLLECTION,
    BET_SIDE,
    BET_PARTICIPANTS_SUBCOLLECTION,
    BET_PARTICIPANT_ROLE,
    VALID_BET_SIDE_VALUES,
    BET_VISIBILITY,
    BET_RESOLUTION_METHOD,
    BET_STATUS,
    BET_STAKE_TYPE,
    isValidVisibility,
    isValidResolutionMethod,
    isValidStatus,
    isValidStakeType,
    isValidBetSide,
    shouldActivateBet,
} = require("./betModel");

describe("betModel", () => {
    it("defines the bets collection name", () => {
        expect(BET_COLLECTION).toBe("bets");
    });

    describe("isValidVisibility", () => {
        it("accepts public and private", () => {
            expect(isValidVisibility(BET_VISIBILITY.PUBLIC)).toBe(true);
            expect(isValidVisibility(BET_VISIBILITY.PRIVATE)).toBe(true);
        });

        it("rejects an invalid visibility value", () => {
            expect(isValidVisibility("hidden")).toBe(false);
            expect(isValidVisibility(undefined)).toBe(false);
        });
    });

    describe("isValidResolutionModel", () => {
        it("accepts external and personal", () => {
            expect(isValidResolutionMethod(BET_RESOLUTION_METHOD.EXTERNAL)).toBe(true);
            expect(isValidResolutionMethod(BET_RESOLUTION_METHOD.PERSONAL)).toBe(true);
        });
        
        it("rejects an invalid resolution model", () => {
            expect(isValidResolutionMethod("manual")).toBe(false);
        });

    });

    describe("isValidStatus", () => {
        it("accepts every defined lifecycle status", () => {
            Object.values(BET_STATUS).forEach((status) => {
                expect(isValidStatus(status)).toBe(true);
            });
        });

        it("rejects an invalid status", () => {
            expect(isValidStatus("cancelled")).toBe(false);
        });

        it("defines draft as a valid initial Bet status", () => {
            expect(BET_STATUS.DRAFT).toBe("draft");
        });
    });

    describe("isValidStakeType", () => {
        it("accepts monetary and nonMonetary", () => {
            expect(isValidStakeType(BET_STAKE_TYPE.MONETARY)).toBe(true);
            expect(isValidStakeType(BET_STAKE_TYPE.NON_MONETARY)).toBe(true);
        });

        it("rejects an invalid stake type", () => {
            expect(isValidStakeType("crypto")).toBe(false);
            expect(isValidStakeType(undefined)).toBe(false);
        });
    });

        describe("isValidBetSide", () => {
        it("accepts A and B", () => {
            expect(isValidBetSide(BET_SIDE.A)).toBe(true);
            expect(isValidBetSide(BET_SIDE.B)).toBe(true);
        });

        it("rejects any other side value", () => {
            expect(isValidBetSide("C")).toBe(false);
            expect(isValidBetSide("a")).toBe(false);
            expect(isValidBetSide("Dodgers win")).toBe(false);
            expect(isValidBetSide(undefined)).toBe(false);
        });

        it("derives VALID_BET_SIDE_VALUES from the BET_SIDE enum", () => {
            expect(VALID_BET_SIDE_VALUES).toEqual(["A", "B"]);
        });
    });

    describe("participants", () => {
        it("defines the participants subcollection name", () => {
            expect(BET_PARTICIPANTS_SUBCOLLECTION).toBe("participants");
        });

        it("defines creator and participant roles", () => {
            expect(BET_PARTICIPANT_ROLE.CREATOR).toBe("creator");
            expect(BET_PARTICIPANT_ROLE.PARTICIPANT).toBe("participant");
        });
    });

    describe("shouldActivateBet", () => {
        function counts(overrides = {}) {
            return { status: "draft", participantCount: 2, sideACount: 1, sideBCount: 1, ...overrides };
        }

        it("activates a Draft with two people, one on each side", () => {
            expect(shouldActivateBet(counts())).toBe(true);
        });

        it("activates a Draft with more people once both sides have someone", () => {
            expect(shouldActivateBet(counts({ participantCount: 3, sideACount: 2, sideBCount: 1 }))).toBe(true);
        });

        it("doesn't activate with only the creator", () => {
            expect(shouldActivateBet(counts({ participantCount: 1, sideACount: 1, sideBCount: 0 }))).toBe(false);
        });

        it.each([
            ["everyone on side A", { sideACount: 2, sideBCount: 0 }],
            ["everyone on side B", { sideACount: 0, sideBCount: 2 }],
        ])("doesn't activate with %s", (_label, overrides) => {
            expect(shouldActivateBet(counts(overrides))).toBe(false);
        });

        it.each(["active", "locked", "resolved", "archived"])(
            "doesn't activate a Bet that is already %s",
            (status) => {
                expect(shouldActivateBet(counts({ status }))).toBe(false);
            }
        );

        it("doesn't activate when the counts are missing (old test data)", () => {
            expect(shouldActivateBet({ status: "draft", participantCount: NaN, sideACount: NaN, sideBCount: 1 })).toBe(false);
        });
    });
});