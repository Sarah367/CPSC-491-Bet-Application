// The route-order test loads betRoutes, which pulls in the controller, service, and
// Firebase Admin config. Mock those so no test here touches real Firebase.
jest.mock("../src/config/firebaseAdmin", () => ({ auth: {}, db: {} }));
jest.mock("../src/services/betService", () => ({ createBet: jest.fn() }));

const requireVerifiedEmail = require("../src/middleware/requireVerifiedEmail");

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

// The single error shape every rejection has to produce.
function expectEmailNotVerified(res) {
    expect(res.statusCode).toBe(403);
    expect(Object.keys(res.body).sort()).toEqual(["error", "message"]);
    expect(res.body.error).toBe("email_not_verified");
    expect(res.body.message).toMatch(/verify your email/i);
}

describe("requireVerifiedEmail", () => {
    let res;
    let next;

    beforeEach(() => {
        res = createRes();
        next = jest.fn();
    });

    it("calls next() and sends no response when email_verified is true", () => {
        const req = { user: { uid: "verified-uid", email_verified: true } };

        requireVerifiedEmail(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBeUndefined();
        expect(res.body).toBeUndefined();
    });

    it("responds 403 when email_verified is false", () => {
        const req = { user: { uid: "unverified-uid", email_verified: false } };

        requireVerifiedEmail(req, res, next);

        expectEmailNotVerified(res);
        expect(next).not.toHaveBeenCalled();
    });

    it("responds 403 when the email_verified claim is missing", () => {
        const req = { user: { uid: "no-claim-uid" } };

        requireVerifiedEmail(req, res, next);

        expectEmailNotVerified(res);
        expect(next).not.toHaveBeenCalled();
    });

    it.each([
        ["the string \"true\"", "true"],
        ["the number 1", 1],
    ])("responds 403 when email_verified is %s (strict check)", (_label, value) => {
        const req = { user: { uid: "weird-claim-uid", email_verified: value } };

        requireVerifiedEmail(req, res, next);

        expectEmailNotVerified(res);
        expect(next).not.toHaveBeenCalled();
    });

    it("responds 403 instead of crashing if req.user is missing", () => {
        // Only possible if the middleware were mounted without authMiddleware first.
        const req = {};

        requireVerifiedEmail(req, res, next);

        expectEmailNotVerified(res);
        expect(next).not.toHaveBeenCalled();
    });

    it("ignores a client-supplied emailVerified in the request body", () => {
        const req = {
            user: { uid: "unverified-uid", email_verified: false },
            body: { emailVerified: true, email_verified: true },
        };

        requireVerifiedEmail(req, res, next);

        expectEmailNotVerified(res);
        expect(next).not.toHaveBeenCalled();
    });
});

describe("bet routes middleware order", () => {
    it("runs authMiddleware, then requireVerifiedEmail, then createBet on POST /", () => {
        const betRoutes = require("../src/routes/betRoutes");
        const authMiddleware = require("../src/middleware/authMiddleware");
        const { createBet } = require("../src/controllers/betController");

        const postLayer = betRoutes.stack.find(
            (layer) => layer.route?.path === "/" && layer.route.methods.post
        );

        expect(postLayer).toBeDefined();
        expect(postLayer.route.stack.map((layer) => layer.handle)).toEqual([
            authMiddleware,
            requireVerifiedEmail,
            createBet,
        ]);
    });
});
