// The Firebase Admin config is mocked so these tests never touch real Firebase
// (and never need a service account key to run).
jest.mock("../src/config/firebaseAdmin", () => ({
    auth: {
        verifyIdToken: jest.fn(),
    },
}));

const { auth } = require("../src/config/firebaseAdmin");
const authMiddleware = require("../src/middleware/authMiddleware");

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

// The single error shape every 401 path has to produce.
function expectUnauthorized(res) {
    expect(res.statusCode).toBe(401);
    expect(Object.keys(res.body).sort()).toEqual(["error", "message"]);
    expect(res.body.error).toBe("unauthorized");
    expect(typeof res.body.message).toBe("string");
    expect(res.body.message.length).toBeGreaterThan(0);
}

describe("authMiddleware", () => {
    let res;
    let next;
    let consoleErrorSpy;

    beforeEach(() => {
        auth.verifyIdToken.mockReset();
        res = createRes();
        next = jest.fn();
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it("responds 401 when the Authorization header is missing", async () => {
        const req = { headers: {} };

        await authMiddleware(req, res, next);

        expectUnauthorized(res);
        expect(next).not.toHaveBeenCalled();
        expect(auth.verifyIdToken).not.toHaveBeenCalled();
        expect(req.user).toBeUndefined();
    });

    it.each([
        ["no scheme", "sometokenvalue"],
        ["wrong scheme", "Basic sometokenvalue"],
        ["wrong casing", "bearer sometokenvalue"],
        ["missing token", "Bearer"],
        ["empty token", "Bearer "],
        ["too many parts", "Bearer some token"],
        ["empty header", ""],
    ])("responds 401 when the Authorization header is malformed (%s)", async (_label, header) => {
        const req = { headers: { authorization: header } };

        await authMiddleware(req, res, next);

        expectUnauthorized(res);
        expect(next).not.toHaveBeenCalled();
        expect(auth.verifyIdToken).not.toHaveBeenCalled();
        expect(req.user).toBeUndefined();
    });

    it("responds 401 when verifyIdToken rejects the token", async () => {
        const firebaseError = new Error("Firebase ID token has expired.");
        firebaseError.code = "auth/id-token-expired";
        auth.verifyIdToken.mockRejectedValue(firebaseError);

        const req = { headers: { authorization: "Bearer expired-token" } };

        await authMiddleware(req, res, next);

        expectUnauthorized(res);
        expect(auth.verifyIdToken).toHaveBeenCalledWith("expired-token");
        expect(next).not.toHaveBeenCalled();
        expect(req.user).toBeUndefined();
        // Logged server-side, but not leaked to the client.
        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(JSON.stringify(res.body)).not.toContain("Firebase ID token has expired.");
        expect(JSON.stringify(res.body)).not.toContain("auth/id-token-expired");
    });

    it("attaches the decoded token and calls next() for a valid token", async () => {
        const decodedToken = {
            uid: "verified-uid-123",
            email: "tester@example.com",
            email_verified: true,
            aud: "bet-app",
        };
        auth.verifyIdToken.mockResolvedValue(decodedToken);

        const req = { headers: { authorization: "Bearer good-token" } };

        await authMiddleware(req, res, next);

        expect(auth.verifyIdToken).toHaveBeenCalledWith("good-token");
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBeUndefined();
        expect(req.user).toEqual(decodedToken);
        expect(req.user.uid).toBe("verified-uid-123");
    });

    it("ignores a client-supplied uid and only trusts the verified token", async () => {
        auth.verifyIdToken.mockResolvedValue({ uid: "verified-uid-123" });

        const req = {
            headers: { authorization: "Bearer good-token" },
            body: { uid: "attacker-uid" },
            query: { uid: "attacker-uid" },
        };

        await authMiddleware(req, res, next);

        expect(req.user.uid).toBe("verified-uid-123");
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("does not fall back to a client-supplied uid when verification fails", async () => {
        auth.verifyIdToken.mockRejectedValue(new Error("invalid signature"));

        const req = {
            headers: { authorization: "Bearer bad-token" },
            body: { uid: "attacker-uid" },
        };

        await authMiddleware(req, res, next);

        expectUnauthorized(res);
        expect(req.user).toBeUndefined();
        expect(next).not.toHaveBeenCalled();
    });
});
