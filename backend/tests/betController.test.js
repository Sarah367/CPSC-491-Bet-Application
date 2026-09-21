jest.mock("../src/services/betService", () => ({
    listPublicBets: jest.fn(),
}));

const betService = require("../src/services/betService");
const { listPublicBets } = require("../src/controllers/betController");

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

function fakeBet(overrides = {}) {
    return {
        id: "generated-id",
        title: "Will the Dodgers win on Friday?",
        deadline: "2026-12-31T00:00:00.000Z",
        visibility: "public",
        status: "active",
        creatorUid: "some-user-uid",
        createdAt: "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

describe("listPublicBets controller", () => {
    let res;

    beforeEach(() => {
        betService.listPublicBets.mockReset();
        res = createRes();
    });

    it("returns 200 and the list of public bets", async () => {
        const bets = [fakeBet(), fakeBet({ id: "second-id" })];
        betService.listPublicBets.mockResolvedValue(bets);

        await listPublicBets({}, res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ bets });
        expect(betService.listPublicBets).toHaveBeenCalledTimes(1);
    });

    it("returns an empty list when there are no public bets", async () => {
        betService.listPublicBets.mockResolvedValue([]);

        await listPublicBets({}, res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ bets: [] });
    });

    it("returns 500 if betService throws unexpectedly", async () => {
        betService.listPublicBets.mockRejectedValue(new Error("Firestore is down"));
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        await listPublicBets({}, res);

        expect(res.statusCode).toBe(500);
        expect(res.body.error).toBe("server_error");

        consoleErrorSpy.mockRestore();
    });
});
