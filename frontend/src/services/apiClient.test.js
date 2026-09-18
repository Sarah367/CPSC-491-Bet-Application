// Firebase is mocked so these tests never touch a real Firebase project
// (and never need a signed-in user or real credentials to run).
// This mirrors how SCRUM-16's backend tests mock verifyIdToken().
vi.mock("./firebase", () => ({
    auth: {
        currentUser: null,
    },
}));

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { auth } from "./firebase";
import {
    apiRequest,
    apiGet,
    apiPost,
    ApiError,
    NotAuthenticatedError,
} from "./apiClient";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Stands in for a Firebase User: only getIdToken() matters to the client.
function signIn(token = "fake-id-token") {
    const getIdToken = vi.fn().mockResolvedValue(token);
    auth.currentUser = { uid: "test-uid-123", getIdToken };
    return getIdToken;
}

function signOut() {
    auth.currentUser = null;
}

// Minimal fetch Response stand-in.
function mockResponse(status, body) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => {
            if (body === undefined) {
                throw new SyntaxError("Unexpected end of JSON input");
            }
            return body;
        },
    };
}

describe("apiClient", () => {
    beforeEach(() => {
        signOut();
        globalThis.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("attaches the Firebase ID token as an Authorization: Bearer header", async () => {
        signIn("fake-id-token");
        globalThis.fetch.mockResolvedValue(mockResponse(200, { message: "Authenticated" }));

        await apiGet("/protected");

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        const [, init] = globalThis.fetch.mock.calls[0];
        expect(init.headers.Authorization).toBe("Bearer fake-id-token");
    });

    it("requests a fresh token on every call", async () => {
        const getIdToken = signIn();
        globalThis.fetch.mockResolvedValue(mockResponse(200, {}));

        await apiGet("/protected");
        await apiGet("/protected");

        expect(getIdToken).toHaveBeenCalledTimes(2);
    });

    it("builds the URL from VITE_API_BASE_URL", async () => {
        signIn();
        globalThis.fetch.mockResolvedValue(mockResponse(200, {}));

        await apiGet("/protected");

        const [url] = globalThis.fetch.mock.calls[0];
        expect(url).toBe(`${API_BASE_URL}/protected`);
    });

    it("joins base URL and path without duplicating or dropping slashes", async () => {
        signIn();
        globalThis.fetch.mockResolvedValue(mockResponse(200, {}));

        await apiGet("protected");

        const [url] = globalThis.fetch.mock.calls[0];
        expect(url).toBe(`${API_BASE_URL}/protected`);
    });

    it("returns the parsed JSON body on success", async () => {
        signIn();
        globalThis.fetch.mockResolvedValue(
            mockResponse(200, { message: "Authenticated", uid: "test-uid-123" }),
        );

        const data = await apiGet("/protected");

        expect(data).toEqual({ message: "Authenticated", uid: "test-uid-123" });
    });

    it("sends a JSON body and content type on POST", async () => {
        signIn();
        globalThis.fetch.mockResolvedValue(mockResponse(200, {}));

        await apiPost("/bets", { title: "Dodgers win Friday" });

        const [, init] = globalThis.fetch.mock.calls[0];
        expect(init.method).toBe("POST");
        expect(init.headers["Content-Type"]).toBe("application/json");
        expect(init.body).toBe(JSON.stringify({ title: "Dodgers win Friday" }));
        expect(init.headers.Authorization).toBe("Bearer fake-id-token");
    });

    it("does not send a body or content type on GET", async () => {
        signIn();
        globalThis.fetch.mockResolvedValue(mockResponse(200, {}));

        await apiGet("/protected");

        const [, init] = globalThis.fetch.mock.calls[0];
        expect(init.body).toBeUndefined();
        expect(init.headers["Content-Type"]).toBeUndefined();
    });

    it("keeps caller-supplied headers alongside the Authorization header", async () => {
        signIn();
        globalThis.fetch.mockResolvedValue(mockResponse(200, {}));

        await apiRequest("/protected", { headers: { "X-Trace-Id": "abc" } });

        const [, init] = globalThis.fetch.mock.calls[0];
        expect(init.headers["X-Trace-Id"]).toBe("abc");
        expect(init.headers.Authorization).toBe("Bearer fake-id-token");
    });

    it("throws NotAuthenticatedError and never calls fetch when no user is signed in", async () => {
        signOut();

        await expect(apiGet("/protected")).rejects.toBeInstanceOf(NotAuthenticatedError);
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("propagates a getIdToken() failure without calling fetch", async () => {
        const getIdToken = vi.fn().mockRejectedValue(new Error("auth/network-request-failed"));
        auth.currentUser = { uid: "test-uid-123", getIdToken };

        await expect(apiGet("/protected")).rejects.toThrow("auth/network-request-failed");
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("throws ApiError carrying the status and body when the backend rejects the token", async () => {
        signIn();
        globalThis.fetch.mockResolvedValue(
            mockResponse(401, { error: "unauthorized", message: "Invalid token" }),
        );

        const error = await apiGet("/protected").catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect(error.status).toBe(401);
        expect(error.body).toEqual({ error: "unauthorized", message: "Invalid token" });
    });

    it("throws ApiError with a null body when the error response is not JSON", async () => {
        signIn();
        globalThis.fetch.mockResolvedValue(mockResponse(500, undefined));

        const error = await apiGet("/protected").catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect(error.status).toBe(500);
        expect(error.body).toBeNull();
    });

    it("returns null rather than throwing when a successful response has no JSON body", async () => {
        signIn();
        globalThis.fetch.mockResolvedValue(mockResponse(204, undefined));

        await expect(apiGet("/protected")).resolves.toBeNull();
    });

    it("propagates a network failure from fetch", async () => {
        signIn();
        globalThis.fetch.mockRejectedValue(new TypeError("Failed to fetch"));

        await expect(apiGet("/protected")).rejects.toThrow("Failed to fetch");
    });
});
