/**
 * HTTP integration tests (SCRUM-66).
 *
 * These send real HTTP requests to the Express app with Supertest, so each
 * request goes through the same path it does in production:
 *   express.json() -> router -> middleware -> controller -> response
 *
 * Supertest calls the app directly, so no server is started (no listen(), no port).
 *
 * Firebase Admin is mocked so these tests never contact the real Firebase project
 * and don't need a service account key. Tests control token verification by
 * setting what auth.verifyIdToken resolves or rejects with.
 */
jest.mock("../../src/config/firebaseAdmin", () => ({
    auth: {
        verifyIdToken: jest.fn(),
    },
    db: {},
}));

const request = require("supertest");
const app = require("../../src/app");
const { auth } = require("../../src/config/firebaseAdmin");

describe("API integration", () => {
    beforeEach(() => {
        auth.verifyIdToken.mockReset();
    });

    describe("GET /api/health", () => {
        it("returns 200 with status ok, without authentication", async () => {
            const res = await request(app).get("/api/health");

            expect(res.status).toBe(200);
            expect(res.headers["content-type"]).toMatch(/json/);
            expect(res.body).toEqual({ status: "ok" });
            expect(auth.verifyIdToken).not.toHaveBeenCalled();
        });
    });

    describe("GET /api/protected", () => {
        it("returns 401 when the Authorization header is missing", async () => {
            const res = await request(app).get("/api/protected");

            expect(res.status).toBe(401);
            expect(res.body.error).toBe("unauthorized");
            expect(auth.verifyIdToken).not.toHaveBeenCalled();
        });

        it("returns 401 when Firebase rejects the token", async () => {
            auth.verifyIdToken.mockRejectedValue(new Error("auth/id-token-expired"));
            const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            const res = await request(app)
                .get("/api/protected")
                .set("Authorization", "Bearer expired-token");

            expect(res.status).toBe(401);
            expect(res.body.error).toBe("unauthorized");
            expect(auth.verifyIdToken).toHaveBeenCalledWith("expired-token");

            consoleSpy.mockRestore();
        });

        it("returns 200 with the uid from the verified token", async () => {
            auth.verifyIdToken.mockResolvedValue({ uid: "test-uid", email_verified: true });

            const res = await request(app)
                .get("/api/protected")
                .set("Authorization", "Bearer valid-token");

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ message: "Authenticated", uid: "test-uid" });
        });
    });

    describe("unknown routes", () => {
        it("returns 404 for a route that doesn't exist", async () => {
            const res = await request(app).get("/api/does-not-exist");

            expect(res.status).toBe(404);
        });
    });
});