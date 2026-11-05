const {
    BET_COLLECTION,
    BET_SIDE,
    BET_PARTICIPANTS_SUBCOLLECTION,
    BET_PARTICIPANT_ROLE,
    VALID_BET_SIDE_VALUES,
    BET_CURRENCY,
    VALID_CURRENCY_VALUES,
    BET_VISIBILITY,
    BET_RESOLUTION_METHOD,
    BET_STATUS,
    BET_STAKE_TYPE,
    isValidVisibility,
    isValidResolutionMethod,
    isValidStatus,
    isValidStakeType,
    isValidBetSide,
    isValidCurrency,
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

    describe("isValidCurrency", () => {
        it("accepts USD", () => {
            expect(isValidCurrency(BET_CURRENCY.USD)).toBe(true);
        });

        it("rejects unsupported, lowercase, or missing currencies", () => {
            expect(isValidCurrency("XYZ")).toBe(false);
            expect(isValidCurrency("EUR")).toBe(false);
            expect(isValidCurrency("usd")).toBe(false);
            expect(isValidCurrency(undefined)).toBe(false);
        });

        it("derives VALID_CURRENCY_VALUES from the BET_CURRENCY enum", () => {
            expect(VALID_CURRENCY_VALUES).toEqual(["USD"]);
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
});