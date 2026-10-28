const {
    isValidVisibility,
    isValidResolutionMethod,
    isValidStakeType,
    isValidBetSide,
    isValidCurrency,
    BET_STAKE_TYPE,
    BET_VISIBILITY,
    VALID_CURRENCY_VALUES,
} = require("../models/betModel");
const betService = require("../services/betService");
const { BetJoinError, JOIN_ERROR } = require("../errors/betJoinError");

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
        if (!isValidCurrency(body.currency.trim())) {
            return {
                valid: false,
                message: `currency must be one of: ${VALID_CURRENCY_VALUES.join(", ")}.`,
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
 
// GET /api/bets/public - requires authMiddleware to have already run.
// Returns every Bet marked as public, regardless of who created it.
async function listPublicBets(req, res) {
    try {
        const bets = await betService.listPublicBets();
 
        return res.status(200).json({ bets });
    } catch (error) {
        console.error("[betController] Failed to list public bets: ", error);
        return res.status(500).json({
            error: "server_error",
            message: "Unable to list public bets.",
        });
    }
}

// GET /api/bets/:id - requires authMiddleware to have already run and populated req.user.
// A private bet looked up by anyone other than its creator returns the same 404
// as a missing bet, so the response never reveals that a private bet exists.
// (creatorDisplayName is resolved in betService.getBetById, alongside the Firestore read.)
async function getBetById(req, res) {
    try {
        const bet = await betService.getBetById(req.params.id);

        if (!bet) {
            return res.status(404).json({ error: "not_found" });
        }

        if (bet.visibility === BET_VISIBILITY.PRIVATE && bet.creatorUid !== req.user.uid) {
            return res.status(404).json({ error: "not_found" });
        }

        // The current user's side and role if they've joined, or null. Lets the Bet Details
        // page show "You joined on ..." and hide the Join section, even after a refresh.
        const viewerParticipation = await betService.getViewerParticipation(req.params.id, req.user.uid);
 
        return res.status(200).json({ bet, viewerParticipation });
    } catch (error) {
        console.error("[betController] Failed to load bet: ", error);
        return res.status(500).json({
            error: "server_error",
            message: "Unable to load bet.",
        });
    }
}

// Validates the POST /api/bets/:id/join body. Values must match exactly, like Create Bet:
// "a", "B ", "true", and 1 are all rejected.
function validateJoinBetBody(body) {
    if (!isValidBetSide(body.side)) {
        return { valid: false, message: "side must be \"A\" or \"B\"." };
    }
 
    if (body.termsAcknowledged !== true) {
        return { valid: false, message: "termsAcknowledged must be true to join a bet." };
    }
 
    return { valid: true };
}

const JOIN_ERROR_STATUS = Object.freeze({
    [JOIN_ERROR.NOT_FOUND]: 404,
    // 409 error means the request itself was fine, but the Bet's current state doesn't allow it.
    [JOIN_ERROR.CREATOR]: 409,
    [JOIN_ERROR.ALREADY_JOINED]: 409,
    [JOIN_ERROR.CLOSED]: 409,
});

// POST /api/bets/:id/join - requires authMiddleware and requireVerifiedEmail.
// The joining user's uid comes only from the verified token, never from the body.
async function joinBet(req, res) {
    const body = req.body || {};
    const validation = validateJoinBetBody(body);
    if (!validation.valid) {
        return sendBadRequest(res, validation.message);
    }
 
    try {
        const bet = await betService.joinBet(req.params.id, req.user.uid, body.side);
 
        return res.status(200).json({
            message: "Joined bet successfully.",
            bet,
            viewerParticipation: { side: body.side, role: "participant" },
        });
    } catch (error) {
        if (error instanceof BetJoinError) {
            return res.status(JOIN_ERROR_STATUS[error.code]).json({
                error: error.code,
                message: error.message,
            });
        }
 
        console.error("[betController] Failed to join bet: ", error);
        return res.status(500).json({
            error: "server_error",
            message: "Unable to join bet.",
        });
    }
}

module.exports = {
    createBet,
    validateCreateBetBody,
    listMyBets,
    listPublicBets,
    getBetById,
    joinBet,
    validateJoinBetBody,
};