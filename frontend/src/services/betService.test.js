import { vi, describe, it, beforeEach, expect } from "vitest";
import { apiGet, apiPost } from "./apiClient";
import { fetchMyBets, joinBet } from "./betService";

vi.mock("./apiClient", () => ({
    apiGet: vi.fn(),
    apiPost: vi.fn(),
}));

describe("fetchMyBets", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("calls GET /bets/mine and returns the bets", async () => {
        const bets = [{ id: "bet-1", title: "Test bet" }];
        apiGet.mockResolvedValueOnce({ bets });

        const result = await fetchMyBets();

        expect(apiGet).toHaveBeenCalledWith("/bets/mine");
        expect(result).toEqual(bets);
    });

    it("returns an empty list when the response has no bets", async () => {
        apiGet.mockResolvedValueOnce({});

        const result = await fetchMyBets();

        expect(result).toEqual([]);
    });

    it("passes errors through so the page can show its error message", async () => {
        apiGet.mockRejectedValueOnce(new Error("network error"));

        await expect(fetchMyBets()).rejects.toThrow("network error");
    });
});

describe("joinBet", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("posts the side and terms acknowledgment to /bets/:id/join", async () => {
        apiPost.mockResolvedValueOnce({});

        await joinBet("bet-1", { side: "B", termsAcknowledged: true });

        expect(apiPost).toHaveBeenCalledWith("/bets/bet-1/join", { side: "B", termsAcknowledged: true });
    });

    it("returns the server's response", async () => {
        const response = {
            message: "Joined bet successfully.",
            bet: { id: "bet-1", participantCount: 2 },
            viewerParticipation: { side: "B", role: "participant" },
        };
        apiPost.mockResolvedValueOnce(response);

        await expect(joinBet("bet-1", { side: "B", termsAcknowledged: true })).resolves.toEqual(response);
    });

    it("passes errors through unchanged so the page can tell them apart", async () => {
        const error = Object.assign(new Error("Request failed with status 409"), { status: 409 });
        apiPost.mockRejectedValueOnce(error);

        await expect(joinBet("bet-1", { side: "A", termsAcknowledged: true })).rejects.toBe(error);
    });
});
