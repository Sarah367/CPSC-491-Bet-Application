const { auth } = require("../config/firebaseAdmin");

// Every 401 from this middleware uses this shape so clients only ever have to
// handle one error format. Firebase's own error details are logged server-side
// and deliberately not sent to the client.
function sendUnauthorized(res, message) {
    return res.status(401).json({
        error: "unauthorized",
        message,
    });
}

/**
 * Verifies the Firebase ID token on an incoming request.
 *
 * The only trusted identity is the one returned by auth.verifyIdToken(). A uid
 * supplied by the client (body, query, custom header, ...) is never used, and
 * there is intentionally no fallback path that accepts one.
 */
async function authMiddleware(req, res, next) {
    const header = req.headers.authorization;

    if (!header) {
        return sendUnauthorized(res, "Authorization header is missing.");
    }

    // Require exactly "Bearer <token>": two parts, the scheme spelled "Bearer",
    // and a non-empty token.
    const parts = header.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
        return sendUnauthorized(
            res,
            "Authorization header must be in the format \"Bearer <token>\"."
        );
    }

    const token = parts[1];

    let decodedToken;
    try {
        decodedToken = await auth.verifyIdToken(token);
    } catch (err) {
        console.error("[auth] ID token verification failed:", err);
        return sendUnauthorized(res, "Invalid or expired authentication token.");
    }

    // decodedToken.uid comes from the verified token, never from the request.
    req.user = decodedToken;

    return next();
}

module.exports = authMiddleware;
