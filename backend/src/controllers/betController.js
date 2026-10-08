const {
    isValidVisibility,
    isValidResolutionMethod,
    isValidStakeType,
    isValidBetSide,
    BET_STAKE_TYPE,
} = require("../models/betModel");
const betService = require("../services/betService");

function sendBadRequest(res, message) {
    return res.status(400).json({error: "invalid_request", message});
}

function isBlankString(value) {
    return typeof value !== "string" || value.trim().length === 0;
}

function isPositiveInteger(value) {
    return typeof value === "number" && Number.isInteger(value) && value > 0;
}

// Outcomes are compared after trimming and ignoring case, so "Yes" and " yes " count as the same side.
function normalizeOutcome(value) {
    return value.trim().toLowerCase();
}

function parseDate(value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Validates the POST /api/bets request body. Only fields the client is allowed to control are checked here:
// title, description, outcomeA, outcomeB, deadline, outcomeDeadline, visibility, resolutionMethod,
// stake fields, creatorSide, and termsAcknowledged.
// creatorUid, createdAt, status, and all participant summary fields (participantUids, participantCount,
// sideACount, sideBCount) are never read from the body. The backend always sets them.

function validateCreateBetBody(body) {
    if (isBlankString(body.title)) {
        return {valid: false, message: "title is required."};
    }

    if (isBlankString(body.description)) {
        return { valid: false, message: "description is required."};
    }

    if (isBlankString(body.outcomeA)) {
        return { valid: false, message: "outcomeA is required." };
    }

    if (isBlankString(body.outcomeB)) {
        return { valid: false, message: "outcomeB is required." };
    }

    if (normalizeOutcome(body.outcomeA) === normalizeOutcome(body.outcomeB)) {
        return { valid: false, message: "outcomeA and outcomeB must be different." };
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

    const parsedDeadline = parseDate(body.deadline);

    if (!parsedDeadline) {
        return { valid: false, message: "deadline must be a valid date."};
    }

    if (parsedDeadline.getTime() <= Date.now()) {
        return { valid: false, message: "deadline must be in the future."};
    }

    if (isBlankString(body.outcomeDeadline)) {
        return { valid: false, message: "outcomeDeadline is required." };
    }

    const parsedOutcomeDeadline = parseDate(body.outcomeDeadline);

    if (!parsedOutcomeDeadline) {
        return { valid: false, message: "outcomeDeadline must be a valid date." };
    }

    // Strictly later: a Bet should never lock and become due for resolution at the same moment.
    if (parsedOutcomeDeadline.getTime() <= parsedDeadline.getTime()) {
        return { valid: false, message: "outcomeDeadline must be after deadline." };
    }

    if (!isValidStakeType(body.stakeType)) {
        return {
            valid: false,
            message: "stakeType must be \"monetary\" or \"nonMonetary\".",
        };
    }

    if (body.stakeType === BET_STAKE_TYPE.MONETARY) {
        if (!isPositiveInteger(body.stakeAmountCents)) {
            return {
                valid: false,
                message: "stakeAmountCents must be a positive integer for monetary stakes."
            };
        }

        if (isBlankString(body.currency)) {
            return {
                valid: false,
                message: "currency is required for monetary stakes."
            };
        }
    } else if (isBlankString(body.stakeDescription)) {
        return {
            valid: false,
            message: "stakeDescription is required for non-monetary stakes."
        };
    }

    if (!isValidBetSide(body.creatorSide)) {
        return { valid: false, message: "creatorSide must be \"A\" or \"B\"." };
    }

    // Must be the boolean true. Truthy values like "true" or 1 are rejected on purpose.
    if (body.termsAcknowledged !== true) {
        return { valid: false, message: "termsAcknowledged must be true to create a bet." };
    }

    return { valid: true, deadline: parsedDeadline, outcomeDeadline: parsedOutcomeDeadline };
}

// POST/api/bets - requires authMiddleware to have already run and populated req.user.

async function createBet(req, res) {
    const validation = validateCreateBetBody(req.body ?? {});

    if (!validation.valid) {
        return sendBadRequest(res, validation.message);
    }

    try {
        const stakeFields = req.body.stakeType === BET_STAKE_TYPE.MONETARY
            ? {
                stakeAmountCents: req.body.stakeAmountCents,
                currency: req.body.currency.trim(),
            }
            : {
                stakeDescription: req.body.stakeDescription.trim(),
            };

        const bet = await betService.createBet({
            title: req.body.title.trim(),
            description: req.body.description.trim(),
            outcomeA: req.body.outcomeA.trim(),
            outcomeB: req.body.outcomeB.trim(),
            // creatorUid comes from verified token - never from request body (prevents spoofing the time/date)
            creatorUid: req.user.uid,
            deadline: validation.deadline,
            outcomeDeadline: validation.outcomeDeadline,
            visibility: req.body.visibility,
            resolutionMethod: req.body.resolutionMethod,
            stakeType: req.body.stakeType,
            ...stakeFields,
            creatorSide: req.body.creatorSide,
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

// GET /api/bets/mine - requires authMiddleware to have already run and populated req.user.
// The creator uid comes only from the verified token; any uid/creatorUid in the
// query, body, or headers is ignored.
async function listMyBets(req, res) {
    try {
        const bets = await betService.getBetsByCreator(req.user.uid);

        return res.status(200).json({ bets });
    } catch (error) {
        console.error("[betController] Failed to list the user's bets: ", error);
        return res.status(500).json({
            error: "server_error",
            message: "Unable to load your bets.",
        });
    }
}

module.exports = { createBet, validateCreateBetBody, listMyBets };