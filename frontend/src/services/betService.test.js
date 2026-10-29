import { vi, describe, it, beforeEach, expect } from "vitest";
import { apiPost } from "./apiClient";
import { joinBet } from "./betService";

vi.mock("./apiClient", () => ({
    apiGet: vi.fn(),
    apiPost: vi.fn(),
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
