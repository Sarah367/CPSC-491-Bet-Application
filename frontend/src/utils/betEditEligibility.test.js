import { describe, it, expect } from "vitest";
import { canEditBet } from "./betEditEligibility";

const NOW = Date.parse("2026-10-29T12:00:00.000Z");

function bet(overrides = {}) {
    return {
        creatorUid: "creator-uid",
        status: "draft",
        participantCount: 1,
        deadline: "2026-10-30T12:00:00.000Z",
        ...overrides,
    };
}

function check(betOverrides = {}, uid = "creator-uid") {
    return canEditBet({ bet: bet(betOverrides), uid, now: NOW });
}

describe("canEditBet", () => {
    it("allows the creator to edit their Draft that nobody else has joined, before the deadline", () => {
        expect(check()).toBe(true);
    });

    it("doesn't allow anyone but the creator", () => {
        expect(check({}, "someone-else")).toBe(false);
    });

    it.each(["active", "locked", "resolved", "archived"])("doesn't allow editing a Bet with status %s", (status) => {
        expect(check({ status })).toBe(false);
    });

    it("doesn't allow editing once someone else has joined, even if it's still a Draft", () => {
        expect(check({ participantCount: 2 })).toBe(false);
    });

    it("doesn't allow editing exactly at the deadline, but allows it 1 ms before", () => {
        expect(check({ deadline: new Date(NOW).toISOString() })).toBe(false);
        expect(check({ deadline: new Date(NOW + 1).toISOString() })).toBe(true);
    });

    it("doesn't allow editing a Bet with a missing deadline", () => {
        expect(check({ deadline: undefined })).toBe(false);
    });

    it("doesn't allow anything without a Bet or a signed-in user", () => {
        expect(canEditBet({ bet: null, uid: "creator-uid", now: NOW })).toBe(false);
        expect(canEditBet({ bet: bet(), uid: null, now: NOW })).toBe(false);
    });
});
