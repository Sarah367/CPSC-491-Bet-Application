const {
    BET_COLLECTION,
    BET_VISIBILITY,
    BET_RESOLUTION_METHOD,
    BET_STATUS,
    BET_STAKE_TYPE,
    isValidVisibility,
    isValidResolutionMethod,
    isValidStatus,
    isValidStakeType,
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
});