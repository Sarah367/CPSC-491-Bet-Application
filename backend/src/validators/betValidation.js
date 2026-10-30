const {
    isValidVisibility,
    isValidResolutionMethod,
    isValidStakeType,
    isValidBetSide,
    isValidCurrency,
    BET_STAKE_TYPE,
    VALID_CURRENCY_VALUES,
} = require("../models/betModel");
 
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

// The rules every Bet's client-controlled fields must follow: title, description, outcomeA, outcomeB,
// deadline, outcomeDeadline, visibility, resolutionMethod, the stake fields, and creatorSide.
// Used by Create Bet (validateCreateBetBody adds the terms check on top) and by Edit Bet (SCRUM-36),
// which validates the stored Bet with the requested changes applied.
 
function validateBetFields(body) {
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
 
    return { valid: true, deadline: parsedDeadline, outcomeDeadline: parsedOutcomeDeadline };
}
 
module.exports = { validateBetFields, isBlankString };