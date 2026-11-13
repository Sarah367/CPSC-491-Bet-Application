import {describe, it, expect} from "vitest";
import {DEADLINE_FORMAT, NO_DEADLINE, formatDeadline} from "./formatDeadline";

// Noon UTC is the same calendar day in every US time zone and in UTC, so these
// checks pass on a laptop in California and in CI (which runs in UTC).
const NOON_UTC = "2026-11-15T12:00:00.000Z";

describe("formatDeadline", () => {
    it("formats an ISO date with the full month name, day, and year", () => {
        const text = formatDeadline(NOON_UTC);

        expect(text).toContain("November");
        expect(text).toContain("15");
        expect(text).toContain("2026");
        expect(text).not.toContain("Nov ");
    });

    it("uses the shared format, in the viewer's own time zone", () => {
        expect(formatDeadline(NOON_UTC)).toBe(
            new Date(NOON_UTC).toLocaleString(undefined, DEADLINE_FORMAT)
        );
    });

    it("includes the time, not just the date", () => {
        expect(formatDeadline(NOON_UTC)).toMatch(/\d{1,2}:\d{2}/);
    });

    it("accepts a Date or a timestamp, as well as a string", () => {
        const expected = formatDeadline(NOON_UTC);

        expect(formatDeadline(new Date(NOON_UTC))).toBe(expected);
        expect(formatDeadline(Date.parse(NOON_UTC))).toBe(expected);
    });

    it.each([
        ["undefined", undefined],
        ["null", null],
        ["an empty string", ""],
        ["text that isn't a date", "not a date"],
        ["an invalid Date", new Date("invalid")],
    ])("shows No deadline for %s", (_label, value) => {
        expect(formatDeadline(value)).toBe(NO_DEADLINE);
        expect(NO_DEADLINE).toBe("No deadline");
    });
});
