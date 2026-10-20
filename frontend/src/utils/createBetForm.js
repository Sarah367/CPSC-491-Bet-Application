export const FIXED_CURRENCY = "USD";
export const BET_SIDES = ["A", "B"];

export const INITIAL_FORM_DATA = {
    title: "",
    description: "",
    outcomeA: "",
    outcomeB: "",
    deadline: "",
    outcomeDeadline: "",
    visibility: "public",
    resolutionMethod: "",
    stakeType: "",
    stakeAmount: "",
    stakeDescription: "",
    creatorSide: "",
    termsAcknowledged: false,
};

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

export function parseAmountToCents(amount) {
    const trimmed = amount.trim();
    if (!AMOUNT_PATTERN.test(trimmed)) {
        return null;
    }
    const [whole, fraction=""] = trimmed.split(".");
    return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function isBlank(value) {
    return value.trim().length === 0;
}

function normalizeOutcome(value) {
    return value.trim().toLowerCase();
}

function parseDate(value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function validateCreateBetForm(formData, now = new Date()) {
    const errors = {};

    if (isBlank(formData.title)) {
        errors.title = "Title is required.";
    }

    if (isBlank(formData.description)) {
        errors.description = "Description is required.";
    } 

    if (isBlank(formData.outcomeA)) {
        errors.outcomeA = "Outcome A is required.";
    }

    if (isBlank(formData.outcomeB)) {
        errors.outcomeB = "Outcome B is required.";
    } else if (
        !errors.outcomeA && 
        normalizeOutcome(formData.outcomeA) === normalizeOutcome(formData.outcomeB)
    ) {
        errors.outcomeB = "Outcome B must be different from Outcome A.";
    }

    let deadline = null;
    if (isBlank(formData.deadline)) {
        errors.deadline = "Participation deadline is required.";
    } else {
        deadline = parseDate(formData.deadline);
        if (!deadline) {
            errors.deadline = "Participation deadline must be a valid date.";
        } else if (deadline.getTime() <= now.getTime()) {
            errors.deadline = "Participation deadline must be in the future.";
        }
    }

    if (isBlank(formData.outcomeDeadline)) {
        errors.outcomeDeadline = "Outcome deadline is required.";
    } else {
        const outcomeDeadline = parseDate(formData.outcomeDeadline);
        if (!outcomeDeadline) {
            errors.outcomeDeadline = "Outcome deadline must be a valid date.";
        } else if (deadline && outcomeDeadline.getTime() <= deadline.getTime()) {
            errors.outcomeDeadline = "Outcome deadline must be after the participation deadline.";
        }
    }

    if (!["public", "private"].includes(formData.visibility)) {
        errors.visibility = "Choose who can see this bet.";
    }

    if (!["external", "personal"].includes(formData.resolutionMethod)) {
        errors.resolutionMethod = "Choose how this bet will be resolved.";
    }

    if (formData.stakeType === "monetary") {
        if (isBlank(formData.stakeAmount)) {
            errors.stakeAmount = "Stake amount is required.";
        } else {
            const cents = parseAmountToCents(formData.stakeAmount);
            if (cents === null) {
                errors.stakeAmount = "Enter a dollar amount like 10 or 10.50 (up to 2 decimal places).";
            } else if (cents <= 0) {
                errors.stakeAmount = "Stake amount must be greater than $0.00";
            }
        } 
    } else if (formData.stakeType === "nonMonetary") {
        if (isBlank(formData.stakeDescription)) {
            errors.stakeDescription = "Describe what's being wagered.";
        }
    } else {
        errors.stakeType = "Choose a stake type.";
    }

    if (!BET_SIDES.includes(formData.creatorSide)) {
        errors.creatorSide = "Choose which side you're taking.";
    } 
    if (formData.termsAcknowledged !== true) {
        errors.termsAcknowledged = "You must acknowledge the bet terms to create a bet.";
    }
    return errors;

}

export function buildCreateBetPayload(formData) {
    const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        outcomeA: formData.outcomeA.trim(),
        outcomeB: formData.outcomeB.trim(),
        deadline: new Date(formData.deadline).toISOString(),
        outcomeDeadline: new Date(formData.outcomeDeadline).toISOString(),
        visibility: formData.visibility,
        resolutionMethod: formData.resolutionMethod,
        stakeType: formData.stakeType,
        creatorSide: formData.creatorSide,
        termsAcknowledged: formData.termsAcknowledged === true,
    };

    if (formData.stakeType === "monetary") {
        payload.stakeAmountCents = parseAmountToCents(formData.stakeAmount);
        payload.currency = FIXED_CURRENCY;
    } else {
        payload.stakeDescription = formData.stakeDescription.trim();
    }

    return payload;
}