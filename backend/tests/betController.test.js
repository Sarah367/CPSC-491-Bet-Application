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
        outcomeA: "Dodgers win",
        outcomeB: "Dodgers lose",
        deadline: futureDateString(),
        outcomeDeadline: futureDateString(8),
        visibility: "public",
        resolutionMethod: "external",
        stakeType: "monetary",
        stakeAmountCents: 1000,
        currency: "USD",
        creatorSide: "A",
        termsAcknowledged: true,
        ...overrides,
    };
}

describe("validateCreateBetBody", () => {
    it("accepts a fully valid body", () => {
        const result = validateCreateBetBody(validBody());
        expect(result.valid).toBe(true);
        expect(result.deadline).toBeInstanceOf(Date);
        expect(result.outcomeDeadline).toBeInstanceOf(Date);
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

    it("rejects a monetary stake with an unsupported currency", () => {
        const result = validateCreateBetBody(
            validBody({ stakeType: "monetary", stakeAmountCents: 1000, currency: "XYZ" })
        );
        expect(result.valid).toBe(false);
        expect(result.message).toBe("currency must be one of: USD.");
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
        describe("outcomes", () => {
        it.each([
            ["missing", undefined],
            ["blank", ""],
            ["whitespace-only", "   "],
            ["non-string", 42],
        ])("rejects a %s outcomeA", (_label, value) => {
            const result = validateCreateBetBody(validBody({ outcomeA: value }));
            expect(result.valid).toBe(false);
            expect(result.message).toMatch(/outcomeA/);
        });

        it.each([
            ["missing", undefined],
            ["blank", ""],
            ["whitespace-only", "   "],
        ])("rejects a %s outcomeB", (_label, value) => {
            const result = validateCreateBetBody(validBody({ outcomeB: value }));
            expect(result.valid).toBe(false);
            expect(result.message).toMatch(/outcomeB/);
        });

        it.each([
            ["identical", "Yes", "Yes"],
            ["differing only by case", "Yes", "yes"],
            ["differing only by surrounding whitespace", "Yes", "  Yes  "],
        ])("rejects outcomes that are %s", (_label, outcomeA, outcomeB) => {
            const result = validateCreateBetBody(validBody({ outcomeA, outcomeB }));
            expect(result.valid).toBe(false);
            expect(result.message).toMatch(/must be different/);
        });
    });

    describe("outcomeDeadline", () => {
        it("rejects a missing outcomeDeadline", () => {
            const result = validateCreateBetBody(validBody({ outcomeDeadline: undefined }));
            expect(result.valid).toBe(false);
            expect(result.message).toMatch(/outcomeDeadline is required/);
        });

        it("rejects a malformed outcomeDeadline", () => {
            const result = validateCreateBetBody(validBody({ outcomeDeadline: "not-a-date" }));
            expect(result.valid).toBe(false);
            expect(result.message).toMatch(/outcomeDeadline must be a valid date/);
        });

        it("rejects an outcomeDeadline before the deadline", () => {
            const result = validateCreateBetBody(
                validBody({ deadline: futureDateString(7), outcomeDeadline: futureDateString(3) })
            );
            expect(result.valid).toBe(false);
            expect(result.message).toMatch(/after deadline/);
        });

        it("rejects an outcomeDeadline equal to the deadline", () => {
            const sameTime = futureDateString(7);
            const result = validateCreateBetBody(
                validBody({ deadline: sameTime, outcomeDeadline: sameTime })
            );
            expect(result.valid).toBe(false);
            expect(result.message).toMatch(/after deadline/);
        });
    });

    describe("creatorSide", () => {
        it.each([undefined, "C", "a", "Dodgers win"])("rejects creatorSide %p", (creatorSide) => {
            const result = validateCreateBetBody(validBody({ creatorSide }));
            expect(result.valid).toBe(false);
            expect(result.message).toMatch(/creatorSide/);
        });

        it.each(["A", "B"])("accepts creatorSide %s", (creatorSide) => {
            expect(validateCreateBetBody(validBody({ creatorSide })).valid).toBe(true);
        });
    });

    describe("termsAcknowledged", () => {
        it.each([
            ["missing", undefined],
            ["false", false],
            ["the string \"true\"", "true"],
            ["the number 1", 1],
        ])("rejects termsAcknowledged when %s", (_label, termsAcknowledged) => {
            const result = validateCreateBetBody(validBody({ termsAcknowledged }));
            expect(result.valid).toBe(false);
            expect(result.message).toMatch(/termsAcknowledged/);
        });
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
                outcomeA: "Dodgers win",
                outcomeB: "Dodgers lose",
                creatorSide: "A",
                outcomeDeadline: expect.any(Date),
            })
        );
    });

    it("trims outcome labels before passing them to the service", async () => {
        betService.createBet.mockResolvedValue({ id: "x" });

        const req = {
            body: validBody({ outcomeA: "  Dodgers win  ", outcomeB: "\tDodgers lose\n" }),
            user: { uid: "real-user-uid" },
        };

        await createBet(req, res);

        expect(betService.createBet).toHaveBeenCalledWith(
            expect.objectContaining({ outcomeA: "Dodgers win", outcomeB: "Dodgers lose" })
        );
    });

    it("accepts a non-monetary bet with the creator on side B", async () => {
        betService.createBet.mockResolvedValue({ id: "x" });

        const req = {
            body: validBody({
                stakeType: "nonMonetary",
                stakeAmountCents: undefined,
                currency: undefined,
                stakeDescription: "Loser buys dinner",
                creatorSide: "B",
            }),
            user: { uid: "real-user-uid" },
        };

        await createBet(req, res);

        expect(res.statusCode).toBe(201);
        expect(betService.createBet).toHaveBeenCalledWith(
            expect.objectContaining({ creatorSide: "B", stakeDescription: "Loser buys dinner" })
        );
    });

    it("never forwards client-supplied participant or server-owned fields to the service", async () => {
        betService.createBet.mockResolvedValue({ id: "x" });

        const req = {
            body: validBody({
                participantUids: ["someone-else"],
                participantCount: 999,
                sideACount: 999,
                sideBCount: 999,
                joinedAt: "2020-01-01T00:00:00.000Z",
                status: "active",
                createdAt: "2020-01-01T00:00:00.000Z",
            }),
            user: { uid: "real-user-uid" },
        };

        await createBet(req, res);

        expect(res.statusCode).toBe(201);
        const [serviceArgs] = betService.createBet.mock.calls[0];
        [
            "participantUids",
            "participantCount",
            "sideACount",
            "sideBCount",
            "joinedAt",
            "status",
            "createdAt",
            "termsAcknowledged",
        ].forEach((field) => expect(serviceArgs).not.toHaveProperty(field));
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
