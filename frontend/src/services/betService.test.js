import { vi, describe, it, beforeEach, expect } from "vitest";
import { apiGet } from "./apiClient";
import { fetchMyBets } from "./betService";

vi.mock("./apiClient", () => ({
    apiGet: vi.fn(),
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
