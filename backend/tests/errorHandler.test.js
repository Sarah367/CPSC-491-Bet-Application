const errorHandler = require("../src/middleware/errorHandler");

function createRes() {
    return {
        statusCode: undefined,
        body: undefined,
        headersSent: false,
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

describe("errorHandler middleware (SCRUM-86)", () => {
    let res;
    let next;
    let consoleSpy;

    beforeEach(() => {
        res = createRes();
        next = jest.fn();
        consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    it("turns a malformed JSON body (express.json's entity.parse.failed) into a 400 JSON error", () => {
        const err = Object.assign(new SyntaxError("Unexpected end of JSON input"), {
            type: "entity.parse.failed",
            status: 400,
        });

        errorHandler(err, {}, res, next);

        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ error: "invalid_request", message: "Request body must be valid JSON." });
        expect(next).not.toHaveBeenCalled();
    });

    it("turns an oversized body (entity.too.large) into a 413 JSON error", () => {
        const err = Object.assign(new Error("request entity too large"), { type: "entity.too.large", status: 413 });

        errorHandler(err, {}, res, next);

        expect(res.statusCode).toBe(413);
        expect(res.body).toEqual({ error: "payload_too_large", message: "Request body is too large." });
    });

    it("turns any other error into a generic 500 JSON error without leaking details", () => {
        errorHandler(new Error("secret internal detail"), {}, res, next);

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ error: "server_error", message: "Something went wrong." });
        expect(JSON.stringify(res.body)).not.toMatch(/secret internal detail/);
        expect(consoleSpy).toHaveBeenCalled();
    });

    it("hands the error to Express if a response was already started", () => {
        res.headersSent = true;
        const err = new Error("too late");

        errorHandler(err, {}, res, next);

        expect(next).toHaveBeenCalledWith(err);
        expect(res.statusCode).toBeUndefined();
    });
});
