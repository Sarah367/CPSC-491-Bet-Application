/**
 * Integration tests for PUT /api/users/me (SCRUM-87), through the real Express app:
 *   PUT /api/users/me -> authMiddleware -> updateMyProfile -> userService.updateDisplayName
 * Firebase Admin is mocked, so no real Firebase project is contacted.
 */
const mockUpdateUser = jest.fn();
const mockTransactionGet = jest.fn();
const mockTransactionSet = jest.fn();

jest.mock("../../src/config/firebaseAdmin", () => ({
    auth: {
        verifyIdToken: jest.fn(),
        updateUser: (...args) => mockUpdateUser(...args),
    },
    db: {
        collection: (name) => ({ doc: (id) => ({ path: `${name}/${id}` }) }),
        runTransaction: async (callback) => {
            return callback({
                get: (ref) => mockTransactionGet(ref),
                set: (ref, data, options) => mockTransactionSet(ref, data, options),
            });
        },
    },
}));

const request = require("supertest");
const app = require("../../src/app");
const { auth } = require("../../src/config/firebaseAdmin");

const TOKEN_UID = "token-uid";
const OTHER_UID = "someone-else";
const NAME_ERROR = {
    error: "invalid_request",
    message: "displayName must be between 1 and 50 characters.",
};

function putAsUser(body) {
    return request(app)
        .put("/api/users/me")
        .set("Authorization", "Bearer valid-token")
        .send(body);
}

beforeEach(() => {
    jest.clearAllMocks();
    auth.verifyIdToken.mockResolvedValue({ uid: TOKEN_UID, email_verified: false });
    mockUpdateUser.mockResolvedValue({});
    mockTransactionGet.mockResolvedValue({ exists: false });
});

describe("PUT /api/users/me", () => {
    it("returns 401 without a token, and changes nothing", async () => {
        const res = await request(app).put("/api/users/me").send({ displayName: "Jordan Rivera" });

        expect(res.status).toBe(401);
        expect(mockUpdateUser).not.toHaveBeenCalled();
        expect(mockTransactionSet).not.toHaveBeenCalled();
    });

    it("saves a trimmed name to Firebase Auth and the profile, and returns it", async () => {
        const res = await putAsUser({ displayName: "  Jordan Rivera  " });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ profile: { displayName: "Jordan Rivera" } });
        expect(mockUpdateUser).toHaveBeenCalledWith(TOKEN_UID, { displayName: "Jordan Rivera" });
        expect(mockTransactionSet).toHaveBeenCalledTimes(1);
        expect(mockTransactionSet.mock.calls[0][0].path).toBe(`users/${TOKEN_UID}`);
        expect(mockTransactionSet.mock.calls[0][1].displayName).toBe("Jordan Rivera");
    });

    it("works for a user whose email isn't verified yet", async () => {
        const res = await putAsUser({ displayName: "Jordan Rivera" });

        expect(res.status).toBe(200);
    });

    it("accepts a name of exactly 50 characters", async () => {
        const res = await putAsUser({ displayName: "a".repeat(50) });

        expect(res.status).toBe(200);
    });

    it.each([
        ["an empty name", { displayName: "" }],
        ["only spaces", { displayName: "    " }],
        ["51 characters", { displayName: "a".repeat(51) }],
        ["a number", { displayName: 42 }],
        ["null", { displayName: null }],
        ["no displayName", {}],
    ])("returns 400 for %s, and changes nothing", async (_label, body) => {
        const res = await putAsUser(body);

        expect(res.status).toBe(400);
        expect(res.body).toEqual(NAME_ERROR);
        expect(mockUpdateUser).not.toHaveBeenCalled();
        expect(mockTransactionSet).not.toHaveBeenCalled();
    });

    it("returns 400 for any field other than displayName", async () => {
        const res = await putAsUser({ displayName: "Jordan Rivera", email: "new@example.com" });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "invalid_request", message: "Only displayName can be updated." });
        expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it("returns 400 for a uid in the body, so nobody can change someone else's name", async () => {
        const res = await putAsUser({ displayName: "Jordan Rivera", uid: OTHER_UID });

        expect(res.status).toBe(400);
        expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it("ignores a uid in the query string and always updates the token's user", async () => {
        const res = await request(app)
            .put(`/api/users/me?uid=${OTHER_UID}`)
            .set("Authorization", "Bearer valid-token")
            .send({ displayName: "Jordan Rivera" });

        expect(res.status).toBe(200);
        expect(mockUpdateUser).toHaveBeenCalledWith(TOKEN_UID, { displayName: "Jordan Rivera" });
        expect(mockUpdateUser).not.toHaveBeenCalledWith(OTHER_UID, expect.anything());
    });

    it("returns a generic 500 when saving fails, without leaking the error", async () => {
        mockTransactionGet.mockRejectedValue(new Error("Firestore quota exceeded"));
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        const res = await putAsUser({ displayName: "Jordan Rivera" });

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "server_error", message: "Unable to update your profile." });
        expect(JSON.stringify(res.body)).not.toMatch(/quota/);
        consoleSpy.mockRestore();
    });
});
