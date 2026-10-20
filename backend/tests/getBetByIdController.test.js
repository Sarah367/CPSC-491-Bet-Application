jest.mock("../src/services/betService", () => ({
    getBetById: jest.fn(),
}));

const betService = require("../src/services/betService");
const { getBetById } = require("../src/controllers/betController");

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
        id: "bet-1",
        title: "Will the Dodgers win on Friday?",
        description: "Friendly wager on Friday's game.",
        deadline: "2026-12-31T00:00:00.000Z",
        visibility: "public",
        resolutionMethod: "external",
        status: "active",
        creatorUid: "creator-uid",
        createdAt: "2026-01-01T00:00:00.000Z",
        creatorDisplayName: "Jordan Rivera",
        ...overrides,
    };
}

describe("getBetById controller", () => {
    let res;

    beforeEach(() => {
        betService.getBetById.mockReset();
        res = createRes();
    });

    it("returns 200 with the bet, including creatorDisplayName", async () => {
        betService.getBetById.mockResolvedValue(fakeBet());

        const req = { params: { id: "bet-1" }, user: { uid: "creator-uid" } };
        await getBetById(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ bet: fakeBet() });
        expect(betService.getBetById).toHaveBeenCalledWith("bet-1");
    });

    it("returns 404 when the bet doesn't exist", async () => {
        betService.getBetById.mockResolvedValue(null);

        const req = { params: { id: "missing-id" }, user: { uid: "someone" } };
        await getBetById(req, res);

        expect(res.statusCode).toBe(404);
        expect(res.body).toEqual({ error: "not_found" });
    });

    it("returns 404 (not 403) for a private bet viewed by a non-creator, without revealing it exists", async () => {
        betService.getBetById.mockResolvedValue(fakeBet({ visibility: "private", creatorUid: "creator-uid" }));

        const req = { params: { id: "bet-1" }, user: { uid: "someone-else" } };
        await getBetById(req, res);

        expect(res.statusCode).toBe(404);
        expect(res.body).toEqual({ error: "not_found" });
    });

    it("returns 200 for a private bet viewed by its own creator", async () => {
        betService.getBetById.mockResolvedValue(fakeBet({ visibility: "private", creatorUid: "creator-uid" }));

        const req = { params: { id: "bet-1" }, user: { uid: "creator-uid" } };
        await getBetById(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.bet.visibility).toBe("private");
    });

    it("returns 500 if betService throws unexpectedly", async () => {
        betService.getBetById.mockRejectedValue(new Error("Firestore is down"));
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        const req = { params: { id: "bet-1" }, user: { uid: "creator-uid" } };
        await getBetById(req, res);

        expect(res.statusCode).toBe(500);
        expect(res.body.error).toBe("server_error");

        consoleErrorSpy.mockRestore();
    });
});
