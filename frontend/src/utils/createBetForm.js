export const FIXED_CURRENCY = "USD";

export const INITIAL_FORM_DATA = {
    title: "",
    description: "",
    deadline: "",
    visibility: "public",
    resolutionMethod: "",
    stakeType: "",
    stakeAmount: "",
    stakeDescription: "",
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

export function validateCreateBetForm(formData, now = new Date()) {
    const errors = {};

    if (isBlank(formData.title)) {
        errors.title = "Title is required.";
    }

    if (isBlank(formData.description)) {
        errors.description = "Description is required.";
    } 
    if (isBlank(formData.deadline)) {
        errors.deadline = "Deadline is required.";
    } else {
        const deadline = new Date(formData.deadline);
        if (Number.isNaN(deadline.getTime())) {
            errors.deadline = "Deadline must be a valid date.";
        } else if (deadline.getTime() <= now.getTime()) {
            errors.deadline = "Deadline must be in the future.";
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
    return errors;

}

export function buildCreateBetPayload(formData) {
    const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        deadline: new Date(formData.deadline).toISOString(),
        visibility: formData.visibility,
        resolutionMethod: formData.resolutionMethod,
        stakeType: formData.stakeType,
    };

    if (formData.stakeType === "monetary") {
        payload.stakeAmountCents = parseAmountToCents(formData.stakeAmount);
        payload.currency = FIXED_CURRENCY;
    } else {
        payload.stakeDescription = formData.stakeDescription.trim();
    }

    return payload;
}