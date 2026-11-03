// Turns errors that reach the end of the middleware chain into the API's standard
// { error, message } JSON, instead of Express's default HTML error page (SCRUM-86).
//
// The main case is a request body that isn't valid JSON: express.json() rejects it before
// any route runs, with an error whose type is "entity.parse.failed". Without this handler,
// Express answered with an HTML page, unlike every other error in the API.
function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }

    if (err?.type === "entity.parse.failed") {
        return res.status(400).json({
            error: "invalid_request",
            message: "Request body must be valid JSON.",
        });
    }

    if (err?.type === "entity.too.large") {
        return res.status(413).json({
            error: "payload_too_large",
            message: "Request body is too large.",
        });
    }

    // Anything else is unexpected. Log it for us, but never send its details to the client.
    console.error("[errorHandler] Unhandled error: ", err);
    return res.status(500).json({
        error: "server_error",
        message: "Something went wrong.",
    });
}

module.exports = errorHandler;
