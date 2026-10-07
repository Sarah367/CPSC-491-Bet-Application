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
    outcomeA: "Dodgers win",
    outcomeB: "Dodgers lose",
    deadline: "2026-10-01T17:00",
    outcomeDeadline: "2026-10-02T17:00",
    visibility: "public",
    resolutionMethod: "external",
    stakeType: "nonMonetary",
    stakeDescription: "Loser buys dinner",
    creatorSide: "A",
    termsAcknowledged: true,
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

    it("requires every field the user has to fill in", () => {
        const errors = validateCreateBetForm(INITIAL_FORM_DATA, NOW);
        expect(Object.keys(errors).sort()).toEqual(
            [
                "creatorSide",
                "deadline",
                "description",
                "outcomeA",
                "outcomeB",
                "outcomeDeadline",
                "resolutionMethod",
                "stakeType",
                "termsAcknowledged",
                "title",
            ].sort()
        );
    });

    it("treats whitespace-only text as blank", () => {
        const errors = validateCreateBetForm({ ...validNonMonetary, title: "   " }, NOW);
        expect(errors.title).toBe("Title is required.");
    });

    it("rejects a participation deadline that is not in the future", () => {
        const errors = validateCreateBetForm({ ...validNonMonetary, deadline: "2026-09-01T10:00" }, NOW);
        expect(errors.deadline).toBe("Participation deadline must be in the future.");
    });

    it("rejects a zero monetary amount", () => {
        const errors = validateCreateBetForm(
            { ...validNonMonetary, stakeType: "monetary", stakeDescription: "", stakeAmount: "0.00" },
            NOW
        );
        expect(errors.stakeAmount).toMatch(/greater than \$0\.00/);
    });

    describe("outcomes", () => {
        it("rejects whitespace-only outcomes", () => {
            const errors = validateCreateBetForm(
                { ...validNonMonetary, outcomeA: "   ", outcomeB: "  " },
                NOW
            );
            expect(errors.outcomeA).toBe("Outcome A is required.");
            expect(errors.outcomeB).toBe("Outcome B is required.");
        });

        it.each([
            ["identical", "Yes", "Yes"],
            ["differing only by case", "Yes", "YES"],
            ["differing only by surrounding whitespace", "Yes", "  Yes "],
        ])("rejects outcomes that are %s", (_label, outcomeA, outcomeB) => {
            const errors = validateCreateBetForm({ ...validNonMonetary, outcomeA, outcomeB }, NOW);
            expect(errors.outcomeB).toBe("Outcome B must be different from Outcome A.");
        });

        it("does not report a duplicate when Outcome A is missing", () => {
            const errors = validateCreateBetForm({ ...validNonMonetary, outcomeA: "" }, NOW);
            expect(errors.outcomeA).toBe("Outcome A is required.");
            expect(errors).not.toHaveProperty("outcomeB");
        });
    });

    describe("outcome deadline", () => {
        it("rejects a malformed outcome deadline", () => {
            const errors = validateCreateBetForm({ ...validNonMonetary, outcomeDeadline: "not-a-date" }, NOW);
            expect(errors.outcomeDeadline).toBe("Outcome deadline must be a valid date.");
        });

        it("rejects an outcome deadline before the participation deadline", () => {
            const errors = validateCreateBetForm(
                { ...validNonMonetary, deadline: "2026-10-02T17:00", outcomeDeadline: "2026-10-01T17:00" },
                NOW
            );
            expect(errors.outcomeDeadline).toBe("Outcome deadline must be after the participation deadline.");
        });

        it("rejects an outcome deadline equal to the participation deadline", () => {
            const errors = validateCreateBetForm(
                { ...validNonMonetary, deadline: "2026-10-01T17:00", outcomeDeadline: "2026-10-01T17:00" },
                NOW
            );
            expect(errors.outcomeDeadline).toBe("Outcome deadline must be after the participation deadline.");
        });

        it("only reports the participation deadline when it is the one that's missing", () => {
            const errors = validateCreateBetForm({ ...validNonMonetary, deadline: "" }, NOW);
            expect(errors.deadline).toBe("Participation deadline is required.");
            expect(errors).not.toHaveProperty("outcomeDeadline");
        });
    });

    describe("creator side and terms", () => {
        it.each(["", "C", "a"])("rejects creatorSide %p", (creatorSide) => {
            const errors = validateCreateBetForm({ ...validNonMonetary, creatorSide }, NOW);
            expect(errors.creatorSide).toBe("Choose which side you're taking.");
        });

        it.each(["A", "B"])("accepts creatorSide %s", (creatorSide) => {
            expect(validateCreateBetForm({ ...validNonMonetary, creatorSide }, NOW)).toEqual({});
        });

        it("requires the terms to be acknowledged", () => {
            const errors = validateCreateBetForm({ ...validNonMonetary, termsAcknowledged: false }, NOW);
            expect(errors.termsAcknowledged).toBe("You must acknowledge the bet terms to create a bet.");
        });
    });
});

describe("buildCreateBetPayload", () => {
    it("never includes server-controlled or participant summary fields", () => {
        const payload = buildCreateBetPayload(validNonMonetary);
        [
            "creatorUid",
            "createdAt",
            "status",
            "participantUids",
            "participantCount",
            "sideACount",
            "sideBCount",
            "joinedAt",
        ].forEach((field) => expect(payload).not.toHaveProperty(field));
    });

    it("sends both deadlines as ISO timestamps", () => {
        const payload = buildCreateBetPayload(validNonMonetary);
        expect(payload.deadline).toBe(new Date("2026-10-01T17:00").toISOString());
        expect(payload.outcomeDeadline).toBe(new Date("2026-10-02T17:00").toISOString());
    });

    it("trims outcomes and sends the creator's side and terms acknowledgment", () => {
        const payload = buildCreateBetPayload({
            ...validNonMonetary,
            outcomeA: "  Dodgers win ",
            outcomeB: " Dodgers lose  ",
            creatorSide: "B",
        });
        expect(payload).toMatchObject({
            outcomeA: "Dodgers win",
            outcomeB: "Dodgers lose",
            creatorSide: "B",
            termsAcknowledged: true,
        });
    });
});