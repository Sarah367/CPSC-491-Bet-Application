import { describe, it, expect } from "vitest";
import { canJoinBet, outcomeForSide } from "./betJoinEligibility";

const NOW = Date.parse("2026-10-21T12:00:00.000Z");

function bet(overrides = {}) {
    return {
        visibility: "public",
        status: "draft",
        creatorUid: "creator-uid",
        deadline: "2026-10-22T12:00:00.000Z",
        outcomeA: "Rain",
        outcomeB: "No rain",
        ...overrides,
    };
}

function check(betOverrides = {}, options = {}) {
    return canJoinBet({
        bet: bet(betOverrides),
        uid: "viewer-uid",
        viewerParticipation: null,
        now: NOW,
        ...options,
    });
}

describe("canJoinBet", () => {
    it("allows a public Draft Bet before its deadline", () => {
        expect(check()).toBe(true);
    });

    it("allows a public Active Bet", () => {
        expect(check({ status: "active" })).toBe(true);
    });

    it("doesn't allow a private Bet", () => {
        expect(check({ visibility: "private" })).toBe(false);
    });

    it.each(["locked", "resolved", "archived"])("doesn't allow a Bet with status %s", (status) => {
        expect(check({ status })).toBe(false);
    });

    it("doesn't allow the creator", () => {
        expect(check({}, { uid: "creator-uid" })).toBe(false);
    });

    it("doesn't allow a user who already joined", () => {
        expect(check({}, { viewerParticipation: { side: "A", role: "participant" } })).toBe(false);
    });

    it("doesn't allow joining exactly at the deadline", () => {
        expect(check({ deadline: new Date(NOW).toISOString() })).toBe(false);
    });

    it("allows joining 1 ms before the deadline", () => {
        expect(check({ deadline: new Date(NOW + 1).toISOString() })).toBe(true);
    });

    it("doesn't allow joining after the deadline", () => {
        expect(check({ deadline: "2026-10-20T12:00:00.000Z" })).toBe(false);
    });

    it("doesn't allow a Bet with a missing deadline", () => {
        expect(check({ deadline: undefined })).toBe(false);
    });

    it("doesn't allow anything without a Bet or a signed-in user", () => {
        expect(canJoinBet({ bet: null, uid: "viewer-uid", viewerParticipation: null, now: NOW })).toBe(false);
        expect(canJoinBet({ bet: bet(), uid: null, viewerParticipation: null, now: NOW })).toBe(false);
    });
});

describe("outcomeForSide", () => {
    it("returns each side's outcome text", () => {
        expect(outcomeForSide(bet(), "A")).toBe("Rain");
        expect(outcomeForSide(bet(), "B")).toBe("No rain");
    });

    it("falls back to Side A or Side B when the outcome is missing", () => {
        expect(outcomeForSide(bet({ outcomeA: "" }), "A")).toBe("Side A");
        expect(outcomeForSide({}, "B")).toBe("Side B");
    });
});
