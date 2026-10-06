jest.mock("../src/services/betService", () => ({
    getBetsByCreator: jest.fn(),
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
        betService.getBetsByCreator.mockReset();
        res = createRes();
    });

    it("returns 200 and the bets for the uid in req.user", async () => {
        const fakeBets = [
            { id: "bet-1", title: "Dodgers win Friday?", creatorUid: "real-user-uid" },
        ];
        betService.getBetsByCreator.mockResolvedValue(fakeBets);

        const req = { query: {}, body: {}, user: { uid: "real-user-uid" } };
        await listMyBets(req, res);

        expect(betService.getBetsByCreator).toHaveBeenCalledTimes(1);
        expect(betService.getBetsByCreator).toHaveBeenCalledWith("real-user-uid");
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ bets: fakeBets });
    });

    it("ignores a spoofed uid/creatorUid in the query, body, and headers", async () => {
        betService.getBetsByCreator.mockResolvedValue([]);

        const req = {
            query: { uid: "spoofed-uid", creatorUid: "spoofed-uid" },
            body: { uid: "spoofed-uid", creatorUid: "spoofed-uid" },
            headers: { "x-user-uid": "spoofed-uid" },
            user: { uid: "real-user-uid" },
        };
        await listMyBets(req, res);

        expect(betService.getBetsByCreator).toHaveBeenCalledWith("real-user-uid");
        expect(betService.getBetsByCreator).not.toHaveBeenCalledWith("spoofed-uid");
    });

    it("returns 200 with an empty list when the user has no bets", async () => {
        betService.getBetsByCreator.mockResolvedValue([]);

        const req = { query: {}, body: {}, user: { uid: "real-user-uid" } };
        await listMyBets(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ bets: [] });
    });

    it("returns 500 if betService throws unexpectedly", async () => {
        betService.getBetsByCreator.mockRejectedValue(new Error("Firestore is down"));
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
