jest.mock("../src/services/betService", () => ({
    createBet: jest.fn(),
}));

const betService = require("../src/services/betService");
const { createBet, validateCreateBetBody } = require("../src/controllers/betController");

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

function futureDateString(daysFromNow = 7) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString();
}

function validBody(overrides = {}) {
    return {
        title: "Will the Dodgers win on Friday?",
        description: "Friendly wager on Friday's game.",
        deadline: futureDateString(),
        visibility: "public",
        resolutionMethod: "external",
        stakeType: "monetary",
        stakeAmountCents: 1000,
        currency: "USD",
        ...overrides,
    };
}

describe("validateCreateBetBody", () => {
    it("accepts a fully valid body", () => {
        const result = validateCreateBetBody(validBody());
        expect(result.valid).toBe(true);
        expect(result.deadline).toBeInstanceOf(Date);
    });

    it("rejects a missing title", () => {
        const result = validateCreateBetBody(validBody({title: ""}));
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/title/i);
    });

    it("rejects a missing description", () => {
        const result = validateCreateBetBody(validBody({description: "   "}));
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/description/i);
    });

    it("rejects an invalid visibility value", () => {
        const result = validateCreateBetBody(validBody({ visibility: "friends-only" }));
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/visibility/i);
    });

    it("rejects an invalid resolution method", () => {
        const result = validateCreateBetBody(validBody({ resolutionMethod: "magic" }));
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/resolutionMethod/i);
    });

    it("rejects a malformed deadline", () => {
        const result = validateCreateBetBody(validBody({ deadline: "not-a-date" }));
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/deadline/i);
    });

    it("rejects a deadline in the past", () => {
        const result = validateCreateBetBody(validBody({ deadline: "2020-01-01T00:00:00.000Z" }));
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/future/i);
    });

    it("rejects a missing stakeType", () => {
        const result = validateCreateBetBody(validBody({ stakeType: undefined }));
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/stakeType/i);
    });
 
    it("rejects an invalid stakeType", () => {
        const result = validateCreateBetBody(validBody({ stakeType: "crypto" }));
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/stakeType/i);
    });
 
    it("rejects a monetary stake missing stakeAmountCents", () => {
        const result = validateCreateBetBody(
            validBody({ stakeType: "monetary", stakeAmountCents: undefined, currency: "USD" })
        );
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/stakeAmountCents/i);
    });
 
    it("rejects a monetary stake with a non-positive stakeAmountCents", () => {
        const result = validateCreateBetBody(
            validBody({ stakeType: "monetary", stakeAmountCents: 0, currency: "USD" })
        );
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/stakeAmountCents/i);
    });
 
    it("rejects a monetary stake missing currency", () => {
        const result = validateCreateBetBody(
            validBody({ stakeType: "monetary", stakeAmountCents: 1000, currency: "" })
        );
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/currency/i);
    });
 
    it("accepts a valid monetary stake", () => {
        const result = validateCreateBetBody(
            validBody({ stakeType: "monetary", stakeAmountCents: 1000, currency: "USD" })
        );
        expect(result.valid).toBe(true);
    });
 
    it("rejects a nonMonetary stake missing stakeDescription", () => {
        const result = validateCreateBetBody(
            validBody({ stakeType: "nonMonetary", stakeDescription: "   " })
        );
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/stakeDescription/i);
    });
 
    it("accepts a valid nonMonetary stake", () => {
        const result = validateCreateBetBody(
            validBody({ stakeType: "nonMonetary", stakeDescription: "Loser buys dinner" })
        );
        expect(result.valid).toBe(true);
    });

});

describe("createBet controller", () => {
    let res;

    beforeEach(() => {
        betService.createBet.mockReset();
        res = createRes();
    });

    it("returns 201 and the created bet on a valid authenticated request", async() => {
        const fakeBet = {
            id: "generated-id",
            title: "Will the Dodgers win on Friday?",
            creatorUid: "real-user-uid",
            status: "draft",
        };
        betService.createBet.mockResolvedValue(fakeBet);

        const req = {
            body: validBody(),
            user: { uid: "real-user-uid" },
        };
        await createBet(req,res);

        expect(res.statusCode).toBe(201);
        expect(res.body.bet).toEqual(fakeBet);
        expect(betService.createBet).toHaveBeenCalledTimes(1);
        expect(betService.createBet).toHaveBeenCalledWith(
            expect.objectContaining({
                stakeType: "monetary",
                stakeAmountCents: 1000,
                currency: "USD",
            })
        );
    });

    it("derives creatorUid from req.user, never from the request body", async () => {
        betService.createBet.mockResolvedValue({ id: "x" });
 
        const req = {
            // A malicious/incorrect client-supplied creatorUid should be ignored...
            body: validBody({ creatorUid: "spoofed-uid" }),
            user: { uid: "real-user-uid" },
        };
 
        await createBet(req, res);
 
        expect(betService.createBet).toHaveBeenCalledWith(
            expect.objectContaining({ creatorUid: "real-user-uid" })
        );
    });
 
    it("returns 400 and does not call betService when the body is invalid", async () => {
        const req = {
            body: validBody({ title: "" }),
            user: { uid: "real-user-uid" },
        };
 
        await createBet(req, res);
 
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe("invalid_request");
        expect(betService.createBet).not.toHaveBeenCalled();
    });
 
    it("returns 500 if betService throws unexpectedly", async () => {
        betService.createBet.mockRejectedValue(new Error("Firestore is down"));
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
 
        const req = {
            body: validBody(),
            user: { uid: "real-user-uid" },
        };
 
        await createBet(req, res);
 
        expect(res.statusCode).toBe(500);
        expect(res.body.error).toBe("server_error");
 
        consoleErrorSpy.mockRestore();
    });
});
