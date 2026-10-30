const {
    isValidBetSide,
    BET_STAKE_TYPE,
    BET_VISIBILITY,
} = require("../models/betModel");
const betService = require("../services/betService");
const { validateBetFields } = require("../validators/betValidation");

const { BetJoinError, JOIN_ERROR } = require("../errors/betJoinError");
const { BetEditError, EDIT_ERROR } = require("../errors/betEditError");


function sendBadRequest(res, message) {
    return res.status(400).json({error: "invalid_request", message});
}


// Validates the POST /api/bets request body. Only fields the client is allowed to control are checked here:
// title, description, outcomeA, outcomeB, deadline, outcomeDeadline, visibility, resolutionMethod,
// stake fields, creatorSide, and termsAcknowledged.
// creatorUid, createdAt, status, and all participant summary fields (participantUids, participantCount,
// sideACount, sideBCount) are never read from the body. The backend always sets them.

function validateCreateBetBody(body) {
    const result = validateBetFields(body);
    if(!result.valid) return result;
    
    // Must be the boolean true. Truthy values like "true" or 1 are rejected on purpose.
    if (body.termsAcknowledged !== true) {
        return { valid: false, message: "termsAcknowledged must be true to create a bet." };
    }
 
    return result;
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
// The fields a creator may change with PATCH /api/bets/:id (SCRUM-36).
const EDITABLE_BET_FIELDS = Object.freeze([
    "title",
    "description",
    "outcomeA",
    "outcomeB",
    "creatorSide",
    "visibility",
    "resolutionMethod",
    "deadline",
    "outcomeDeadline",
    "stakeType",
    "stakeAmountCents",
    "currency",
    "stakeDescription",
]);

// Checks the shape of a PATCH body: a non-empty object with only editable fields. Unlike Create,
// fields the server controls (status, creatorUid, participant counts, and so on) are rejected
// instead of ignored, so a client mistake doesn't silently do nothing. The values themselves are
// checked later, together with the stored Bet.
function validateEditBetBody(body) {
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return { valid: false, message: "Request body must be a JSON object." };
    }
 
    const fields = Object.keys(body);
    if (fields.length === 0) {
        return { valid: false, message: "At least one field to edit is required." };
    }
 
    const notEditable = fields.filter((field) => !EDITABLE_BET_FIELDS.includes(field));
    if (notEditable.length > 0) {
        return { valid: false, message: `These fields can't be edited: ${notEditable.join(", ")}.` };
    }
 
    return { valid: true };
}

const EDIT_ERROR_RESPONSE = Object.freeze({
    [EDIT_ERROR.NOT_FOUND]: { status: 404, body: { error: "not_found", message: "Bet not found." } },
    [EDIT_ERROR.NOT_EDITABLE]: {
        status: 409,
        body: { error: "bet_not_editable", message: "This Bet can no longer be edited." },
    },
});

// PATCH /api/bets/:id - requires authMiddleware and requireVerifiedEmail.
// The editor's uid comes only from the verified token. Responds with a message only, so no stored
// fields (like participantUids) are sent back; the page reloads the Bet through GET /api/bets/:id.
async function updateBet(req, res) {
    const validation = validateEditBetBody(req.body);
    if (!validation.valid) {
        return sendBadRequest(res, validation.message);
    }
 
    try {
        await betService.updateBet(req.params.id, req.user.uid, req.body);
        return res.status(200).json({ message: "Bet updated successfully." });
    } catch (error) {
        if (error instanceof BetEditError) {
            if (error.code === EDIT_ERROR.INVALID) {
                return sendBadRequest(res, error.message);
            }
            const response = EDIT_ERROR_RESPONSE[error.code];
            return res.status(response.status).json(response.body);
        }
 
        console.error("[betController] Failed to update bet: ", error);
        return res.status(500).json({
            error: "server_error",
            message: "Unable to update bet.",
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
    updateBet,
    validateEditBetBody,
    EDITABLE_BET_FIELDS,
};