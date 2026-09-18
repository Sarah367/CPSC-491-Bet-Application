import { auth } from "./firebase";

// Thrown when a request is attempted with no signed-in user, so callers can tell
// "you are not signed in" apart from "the server rejected you".
export class NotAuthenticatedError extends Error {
    constructor(message = "No signed-in user. Sign in before calling the API.") {
        super(message);
        this.name = "NotAuthenticatedError";
    }
}

// Thrown for any non-2xx response, carrying the status and parsed body.
export class ApiError extends Error {
    constructor(status, body) {
        super(`Request failed with status ${status}`);
        this.name = "ApiError";
        this.status = status;
        this.body = body;
    }
}

// getIdToken() returns the cached token and refreshes it automatically when it
// is expired or close to expiring, so every request gets a usable token.
async function getAuthHeader() {
    const user = auth.currentUser;
    if (!user) {
        throw new NotAuthenticatedError();
    }

    const token = await user.getIdToken();
    return `Bearer ${token}`;
}

// Base URL of the backend API, e.g. http://localhost:5001/api (see .env.example).
// Read per request rather than once at module load, so the value is never baked
// in at import time and tests can stub it.
function getBaseUrl() {
    return import.meta.env.VITE_API_BASE_URL ?? "";
}

function buildUrl(path) {
    const base = getBaseUrl().replace(/\/+$/, "");
    const suffix = path.startsWith("/") ? path : `/${path}`;
    return `${base}${suffix}`;
}

/**
 * Makes an authenticated request to the backend API.
 * Attaches the current user's Firebase ID token as `Authorization: Bearer <token>`.
 */
export async function apiRequest(path, options = {}) {
    const { headers = {}, body, ...rest } = options;

    const requestHeaders = {
        ...headers,
        Authorization: await getAuthHeader(),
    };

    // Only send a JSON content type when there is actually a JSON body to send.
    const isPlainObjectBody = body !== undefined && body !== null && typeof body === "object";
    if (isPlainObjectBody && !("Content-Type" in requestHeaders)) {
        requestHeaders["Content-Type"] = "application/json";
    }

    const response = await fetch(buildUrl(path), {
        ...rest,
        headers: requestHeaders,
        ...(body === undefined ? {} : { body: isPlainObjectBody ? JSON.stringify(body) : body }),
    });

    // The backend answers JSON on both success and error paths, but guard against
    // an empty or non-JSON body (e.g. a 204, or a proxy error page).
    let payload;
    try {
        payload = await response.json();
    } catch {
        payload = null;
    }

    if (!response.ok) {
        throw new ApiError(response.status, payload);
    }

    return payload;
}

export function apiGet(path, options = {}) {
    return apiRequest(path, { ...options, method: "GET" });
}

export function apiPost(path, body, options = {}) {
    return apiRequest(path, { ...options, method: "POST", body });
}
