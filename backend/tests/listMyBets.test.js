jest.mock("../src/services/betService", () => ({
    getBetsForUser: jest.fn(),
}));

const betService = require("../src/services/betService");
const { listMyBets } = require("../src/controllers/betController");

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

describe("listMyBets controller", () => {
    let res;

    beforeEach(() => {
        betService.getBetsForUser.mockReset();
        res = createRes();
    });

    it("returns 200 and the bets for the uid in req.user", async () => {
        const fakeBets = [
            { id: "bet-1", title: "Dodgers win Friday?", creatorUid: "real-user-uid" },
        ];
        betService.getBetsForUser.mockResolvedValue(fakeBets);

        const req = { query: {}, body: {}, user: { uid: "real-user-uid" } };
        await listMyBets(req, res);

        expect(betService.getBetsForUser).toHaveBeenCalledTimes(1);
        expect(betService.getBetsForUser).toHaveBeenCalledWith("real-user-uid");
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ bets: fakeBets });
    });

    it("ignores a spoofed uid/creatorUid in the query, body, and headers", async () => {
        betService.getBetsForUser.mockResolvedValue([]);

        const req = {
            query: { uid: "spoofed-uid", creatorUid: "spoofed-uid" },
            body: { uid: "spoofed-uid", creatorUid: "spoofed-uid" },
            headers: { "x-user-uid": "spoofed-uid" },
            user: { uid: "real-user-uid" },
        };
        await listMyBets(req, res);

        expect(betService.getBetsForUser).toHaveBeenCalledWith("real-user-uid");
        expect(betService.getBetsForUser).not.toHaveBeenCalledWith("spoofed-uid");
    });

    it("returns 200 with an empty list when the user has no bets", async () => {
        betService.getBetsForUser.mockResolvedValue([]);

        const req = { query: {}, body: {}, user: { uid: "real-user-uid" } };
        await listMyBets(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ bets: [] });
    });

    it("returns 500 if betService throws unexpectedly", async () => {
        betService.getBetsForUser.mockRejectedValue(new Error("Firestore is down"));
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        const req = { query: {}, body: {}, user: { uid: "real-user-uid" } };
        await listMyBets(req, res);

        expect(res.statusCode).toBe(500);
        expect(res.body.error).toBe("server_error");
        expect(res.body.message).toEqual(expect.any(String));
        expect(consoleErrorSpy).toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
    });
});

// SCRUM-106: optional ?limit= so Home can ask for only its newest few Bets.
describe("listMyBets controller: limit", () => {
    let res;

    beforeEach(() => {
        betService.getBetsForUser.mockReset();
        betService.getBetsForUser.mockResolvedValue([]);
        res = createRes();
    });

    function requestWithLimit(limit) {
        return { query: { limit }, body: {}, user: { uid: "real-user-uid" } };
    }

    it.each([
        ["1", 1],
        ["3", 3],
        ["50", 50],
    ])("passes ?limit=%s to the service as the number %d", async (raw, expected) => {
        await listMyBets(requestWithLimit(raw), res);

        expect(res.statusCode).toBe(200);
        expect(betService.getBetsForUser).toHaveBeenCalledWith("real-user-uid", expected);
    });

    it("calls the service with only the uid when there's no limit", async () => {
        await listMyBets({ query: {}, body: {}, user: { uid: "real-user-uid" } }, res);

        expect(betService.getBetsForUser).toHaveBeenCalledWith("real-user-uid");
        expect(betService.getBetsForUser.mock.calls[0]).toHaveLength(1);
    });

    it.each([
        ["empty", ""],
        ["not a number", "abc"],
        ["a decimal", "2.5"],
        ["zero", "0"],
        ["negative", "-1"],
        ["above the maximum", "51"],
        ["a huge number", "99999999999999999999"],
        ["a leading zero", "03"],
        ["surrounding spaces", " 3"],
        ["exponent notation", "1e3"],
        ["repeated", ["3", "5"]],
        ["an object", { gt: "3" }],
    ])("returns 400 without calling the service when limit is %s", async (_label, raw) => {
        await listMyBets(requestWithLimit(raw), res);

        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({
            error: "invalid_request",
            message: "limit must be a whole number between 1 and 50.",
        });
        expect(betService.getBetsForUser).not.toHaveBeenCalled();
    });

    it("still takes the uid only from the token when a limit is given", async () => {
        const req = {
            query: { limit: "3", uid: "spoofed-uid" },
            body: { uid: "spoofed-uid" },
            user: { uid: "real-user-uid" },
        };

        await listMyBets(req, res);

        expect(betService.getBetsForUser).toHaveBeenCalledWith("real-user-uid", 3);
    });
});
