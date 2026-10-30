jest.mock("../src/services/betService", () => ({
    updateBet: jest.fn(),
}));

const betService = require("../src/services/betService");
const { updateBet, validateEditBetBody, validateCreateBetBody } = require("../src/controllers/betController");
const { BetEditError, EDIT_ERROR } = require("../src/errors/betEditError");

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

function editReq(body, uid = "creator-uid") {
    return { params: { id: "bet-1" }, user: { uid }, body };
}

describe("validateEditBetBody", () => {
    it("accepts any combination of editable fields", () => {
        expect(validateEditBetBody({ title: "New title" })).toEqual({ valid: true });
        expect(validateEditBetBody({ outcomeA: "Yes", creatorSide: "B", stakeType: "monetary" })).toEqual({
            valid: true,
        });
    });

    it.each([
        ["an empty body", {}],
        ["an array", []],
        ["null", null],
        ["a string", "title"],
    ])("rejects %s", (_label, body) => {
        expect(validateEditBetBody(body).valid).toBe(false);
    });

    it.each([
        "status",
        "creatorUid",
        "participantUids",
        "participantCount",
        "sideACount",
        "sideBCount",
        "termsAcknowledged",
        "createdAt",
        "id",
    ])("rejects the server-controlled field %s instead of ignoring it", (field) => {
        const result = validateEditBetBody({ title: "New title", [field]: "anything" });

        expect(result.valid).toBe(false);
        expect(result.message).toBe(`These fields can't be edited: ${field}.`);
    });

    it("rejects an unknown field", () => {
        expect(validateEditBetBody({ notAField: true }).valid).toBe(false);
    });
});

describe("validateCreateBetBody after moving the shared rules", () => {
    it("still requires the terms to be acknowledged when creating", () => {
        const body = {
            title: "Will it rain?",
            description: "Weather bet.",
            outcomeA: "Rain",
            outcomeB: "No rain",
            visibility: "public",
            resolutionMethod: "personal",
            deadline: new Date(Date.now() + 86400000).toISOString(),
            outcomeDeadline: new Date(Date.now() + 2 * 86400000).toISOString(),
            stakeType: "nonMonetary",
            stakeDescription: "Loser buys coffee",
            creatorSide: "A",
        };

        expect(validateCreateBetBody(body)).toEqual({
            valid: false,
            message: "termsAcknowledged must be true to create a bet.",
        });
        expect(validateCreateBetBody({ ...body, termsAcknowledged: true }).valid).toBe(true);
    });
});

describe("updateBet controller", () => {
    let res;

    beforeEach(() => {
        betService.updateBet.mockReset();
        res = createRes();
    });

    it("edits with the uid from the token and responds with a message only", async () => {
        betService.updateBet.mockResolvedValue(undefined);

        await updateBet(editReq({ title: "New title" }), res);

        expect(betService.updateBet).toHaveBeenCalledWith("bet-1", "creator-uid", { title: "New title" });
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ message: "Bet updated successfully." });
    });

    it("returns 400 and doesn't call the service for a body with a protected field", async () => {
        await updateBet(editReq({ title: "New title", creatorUid: "attacker-uid" }), res);

        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({
            error: "invalid_request",
            message: "These fields can't be edited: creatorUid.",
        });
        expect(betService.updateBet).not.toHaveBeenCalled();
    });

    it("returns 400 for an empty body", async () => {
        await updateBet(editReq({}), res);

        expect(res.statusCode).toBe(400);
        expect(betService.updateBet).not.toHaveBeenCalled();
    });

    it("returns 404 with the same body as Bet Details when the Bet is missing or not theirs", async () => {
        betService.updateBet.mockRejectedValue(new BetEditError(EDIT_ERROR.NOT_FOUND, "Bet not found."));

        await updateBet(editReq({ title: "New title" }), res);

        expect(res.statusCode).toBe(404);
        expect(res.body).toEqual({ error: "not_found", message: "Bet not found." });
    });

    it("returns 409 when the Bet can no longer be edited", async () => {
        betService.updateBet.mockRejectedValue(
            new BetEditError(EDIT_ERROR.NOT_EDITABLE, "This Bet can no longer be edited.")
        );

        await updateBet(editReq({ title: "New title" }), res);

        expect(res.statusCode).toBe(409);
        expect(res.body).toEqual({ error: "bet_not_editable", message: "This Bet can no longer be edited." });
    });

    it("returns 400 with the rule's message when the edited Bet breaks a Create Bet rule", async () => {
        betService.updateBet.mockRejectedValue(
            new BetEditError(EDIT_ERROR.INVALID, "outcomeDeadline must be after deadline.")
        );

        await updateBet(editReq({ deadline: "2030-01-01T00:00:00.000Z" }), res);

        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ error: "invalid_request", message: "outcomeDeadline must be after deadline." });
    });

    it("returns 500 without leaking details for an unexpected error", async () => {
        betService.updateBet.mockRejectedValue(new Error("Firestore unavailable"));
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        await updateBet(editReq({ title: "New title" }), res);

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ error: "server_error", message: "Unable to update bet." });
        consoleSpy.mockRestore();
    });
});
