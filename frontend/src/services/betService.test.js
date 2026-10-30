import { vi, describe, it, beforeEach, expect } from "vitest";
import { apiPost, apiPatch } from "./apiClient";
import { joinBet, updateBet } from "./betService";

vi.mock("./apiClient", () => ({
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiPatch: vi.fn(),
}));

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
describe("updateBet (SCRUM-36)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
 
    it("sends the changes to PATCH /bets/:id and returns the response", async () => {
        apiPatch.mockResolvedValueOnce({ message: "Bet updated successfully." });
 
        await expect(updateBet("bet-1", { title: "New title" })).resolves.toEqual({
            message: "Bet updated successfully.",
        });
        expect(apiPatch).toHaveBeenCalledWith("/bets/bet-1", { title: "New title" });
    });
 
    it("passes errors through unchanged", async () => {
        const error = Object.assign(new Error("Request failed with status 409"), { status: 409 });
        apiPatch.mockRejectedValueOnce(error);
 
        await expect(updateBet("bet-1", { title: "New title" })).rejects.toBe(error);
    });
});
