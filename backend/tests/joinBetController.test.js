jest.mock("../src/services/betService", () => ({
    joinBet: jest.fn(),
}));

const betService = require("../src/services/betService");
const { joinBet, validateJoinBetBody } = require("../src/controllers/betController");
const { BetJoinError, JOIN_ERROR } = require("../src/errors/betJoinError");

function createRes() {
    return {
        statusCode: undefined,
        body: undefined,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
    };
}

function joinReq(body, uid = "joiner-uid") {
    return { params: { id: "bet-1" }, user: { uid }, body };
}

describe("validateJoinBetBody", () => {
    it.each(["A", "B"])("accepts side %s with termsAcknowledged true", (side) => {
        expect(validateJoinBetBody({ side, termsAcknowledged: true })).toEqual({ valid: true });
    });

    it.each([
        ["missing", undefined],
        ["lowercase", "a"],
        ["with a space", "B "],
        ["not A or B", "C"],
        ["a number", 1],
    ])("rejects a side that is %s", (_label, side) => {
        const result = validateJoinBetBody({ side, termsAcknowledged: true });
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/side/);
    });

    it.each([
        ["missing", undefined],
        ["false", false],
        ["the string \"true\"", "true"],
        ["the number 1", 1],
    ])("rejects termsAcknowledged that is %s", (_label, termsAcknowledged) => {
        const result = validateJoinBetBody({ side: "A", termsAcknowledged });
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/termsAcknowledged/);
    });
});

describe("joinBet controller", () => {
    let res;

    beforeEach(() => {
        betService.joinBet.mockReset();
        res = createRes();
    });

    it("joins with the uid from the token and returns 200 with the Bet and the viewer's side", async () => {
        const bet = { id: "bet-1", participantCount: 2 };
        betService.joinBet.mockResolvedValue(bet);

        await joinBet(joinReq({ side: "B", termsAcknowledged: true }), res);

        expect(betService.joinBet).toHaveBeenCalledWith("bet-1", "joiner-uid", "B");
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            message: "Joined bet successfully.",
            bet,
            viewerParticipation: { side: "B", role: "participant" },
        });
    });

    it("ignores a spoofed uid in the body", async () => {
        betService.joinBet.mockResolvedValue({ id: "bet-1" });

        await joinBet(
            joinReq({ side: "A", termsAcknowledged: true, uid: "attacker-uid", creatorUid: "attacker-uid" }),
            res
        );

        expect(betService.joinBet).toHaveBeenCalledWith("bet-1", "joiner-uid", "A");
    });

    it("returns 400 and doesn't call the service for an invalid body", async () => {
        await joinBet(joinReq({ side: "C", termsAcknowledged: true }), res);

        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ error: "invalid_request", message: expect.any(String) });
        expect(betService.joinBet).not.toHaveBeenCalled();
    });

    it("returns 400 for a missing body", async () => {
        await joinBet({ params: { id: "bet-1" }, user: { uid: "joiner-uid" } }, res);

        expect(res.statusCode).toBe(400);
        expect(betService.joinBet).not.toHaveBeenCalled();
    });

    it.each([
        [JOIN_ERROR.NOT_FOUND, 404],
        [JOIN_ERROR.CREATOR, 409],
        [JOIN_ERROR.ALREADY_JOINED, 409],
        [JOIN_ERROR.CLOSED, 409],
    ])("maps the %s join error to %i with the { error, message } shape", async (code, status) => {
        betService.joinBet.mockRejectedValue(new BetJoinError(code, "Readable message."));

        await joinBet(joinReq({ side: "A", termsAcknowledged: true }), res);

        expect(res.statusCode).toBe(status);
        expect(res.body).toEqual({ error: code, message: "Readable message." });
    });

    it("returns 500 without leaking details for an unexpected error", async () => {
        betService.joinBet.mockRejectedValue(new Error("Firestore unavailable"));
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        await joinBet(joinReq({ side: "A", termsAcknowledged: true }), res);

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ error: "server_error", message: "Unable to join bet." });
        consoleSpy.mockRestore();
    });
});
