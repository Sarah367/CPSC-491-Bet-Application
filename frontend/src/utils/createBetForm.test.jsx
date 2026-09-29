import { describe, it, expect } from "vitest";
import {
    INITIAL_FORM_DATA,
    parseAmountToCents,
    validateCreateBetForm,
    buildCreateBetPayload,
} from "./createBetForm";

const NOW = new Date("2026-09-26T12:00:00Z");

const validNonMonetary = {
    ...INITIAL_FORM_DATA,
    title: "Will the Dodgers win Friday?",
    description: "Regular season game",
    deadline: "2026-10-01T17:00",
    visibility: "public",
    resolutionMethod: "external",
    stakeType: "nonMonetary",
    stakeDescription: "Loser buys dinner",
};

describe("parseAmountToCents", () => {
    it.each([
        ["10", 1000],
        ["10.5", 1050],
        ["10.50", 1050],
        ["0.99", 99],
        ["19.99", 1999], // 19.99 * 100 would be 1998.9999999999998
        ["1.15", 115], // 1.15 * 100 would be 114.99999999999999
        [" 12.34 ", 1234],
    ])("converts %s to %i cents", (input, expected) => {
        expect(parseAmountToCents(input)).toBe(expected);
    });

    it.each(["10.999", "1e2", "+10", "-5", "10.", ".5", "abc", "1,000", ""])(
        "rejects %s",
        (input) => {
            expect(parseAmountToCents(input)).toBeNull();
        }
    );
});

describe("validateCreateBetForm", () => {
    it("returns no errors for a valid form", () => {
        expect(validateCreateBetForm(validNonMonetary, NOW)).toEqual({});
    });

    it("requires title, description, deadline, resolution method, and stake type", () => {
        const errors = validateCreateBetForm(INITIAL_FORM_DATA, NOW);
        expect(Object.keys(errors).sort()).toEqual(
            ["deadline", "description", "resolutionMethod", "stakeType", "title"].sort()
        );
    });

    it("treats whitespace-only text as blank", () => {
        const errors = validateCreateBetForm({ ...validNonMonetary, title: "   " }, NOW);
        expect(errors.title).toBe("Title is required.");
    });

    it("rejects a deadline that is not in the future", () => {
        const errors = validateCreateBetForm({ ...validNonMonetary, deadline: "2026-09-01T10:00" }, NOW);
        expect(errors.deadline).toBe("Deadline must be in the future.");
    });

    it("rejects a zero monetary amount", () => {
        const errors = validateCreateBetForm(
            { ...validNonMonetary, stakeType: "monetary", stakeDescription: "", stakeAmount: "0.00" },
            NOW
        );
        expect(errors.stakeAmount).toMatch(/greater than \$0\.00/);
    });
});

describe("buildCreateBetPayload", () => {
    it("never includes server-controlled fields", () => {
        const payload = buildCreateBetPayload(validNonMonetary);
        expect(payload).not.toHaveProperty("creatorUid");
        expect(payload).not.toHaveProperty("createdAt");
        expect(payload).not.toHaveProperty("status");
    });

    it("sends the deadline as an ISO timestamp", () => {
        const payload = buildCreateBetPayload(validNonMonetary);
        expect(payload.deadline).toBe(new Date("2026-10-01T17:00").toISOString());
    });
});