const {
    isValidVisibility,
    isValidResolutionMethod,
} = require("../models/betModel");
const betService = require("../services/betService");

function sendBadRequest(res, message) {
    return res.status(400).json({error: "invalid_request", message});
}

function isBlankString(value) {
    return typeof value !== "string" || value.trim().length === 0;
}

// Validates the POST /api/bets request body. Only fields the client is allowed to control are checked here:
// title, description, deadline, visibility, resolutionMethod.
// creatorUid, createdAt, and status are never read from the body, but always set by the backend.

function validateCreateBetBody(body) {
    if (isBlankString(body.title)) {
        return {valid: false, message: "title is required."};
    }

    if (isBlankString(body.description)) {
        return { valid: false, message: "description is required."};
    }

    if (!isValidVisibility(body.visibility)) {
        return {valid: false, message: "visibility must be \"public\" or \"private\"."};
    }

    if (!isValidResolutionMethod(body.resolutionMethod)) {
        return {
            valid: false,
            message: "resolutionMethod must be \"external\" or \"personal\".",
        };
    }

    if (isBlankString(body.deadline)) {
        return { valid: false, message: "deadline is required." };
    }

    const parsedDeadline = new Date(body.deadline);

    if (Number.isNaN(parsedDeadline.getTime())) {
        return { valid: false, message: "deadline must be a valid date."};
    }

    if (parsedDeadline.getTime() <= Date.now()) {
        return { valid: false, message: "deadline must be in the future."};
    }

    return { valid: true, deadline: parsedDeadline };
}

// POST/api/bets - requires authMiddleware to have already run and populated req.user.

async function createBet(req, res) {
    const validation = validateCreateBetBody(req.body ?? {});

    if (!validation.valid) {
        return sendBadRequest(res, validation.message);
    }

    try {
        const bet = await betService.createBet({
            title: req.body.title.trim(),
            description: req.body.description.trim(),
            // creatorUid comes from verified token - never from request body (prevents spoofing the time/date)
            creatorUid: req.user.uid,
            deadline: validation.deadline,
            visibility: req.body.visibility,
            resolutionMethod: req.body.resolutionMethod,
        });

        return res.status(201).json({
            message: "Bet created successfully.",
            bet,
        });
    } catch (error) {
        console.error("[betController] Failed to create bet: ", error);
        return res.status(500).json({
            error: "server_error",
            message: "Unable to create bet.",
        });
    }
}

module.exports = { createBet, validateCreateBetBody};