const BET_COLLECTION = "bets";

const BET_VISIBILITY = Object.freeze({
    PUBLIC: "public",
    PRIVATE: "private",
});

const BET_RESOLUTION_METHOD = Object.freeze({
    EXTERNAL: "external",
    PERSONAL: "personal",
});

const BET_STATUS = Object.freeze({
    DRAFT: "draft",
    ACTIVE: "active",
    LOCKED: "locked",
    RESOLVED: "resolved",
    ARCHIVED: "archived",
});

const VALID_VISIBILITY_VALUES = Object.values(BET_VISIBILITY);
const VALID_RESOLUTION_METHOD_VALUES = Object.values(BET_RESOLUTION_METHOD);
const VALID_STATUS_VALUES = Object.values(BET_STATUS);

function isValidVisibility(value) {
    return VALID_VISIBILITY_VALUES.includes(value);
}

function isValidResolutionMethod(value) {
    return VALID_RESOLUTION_METHOD_VALUES.includes(value);
}

function isValidStatus(value) {
    return VALID_STATUS_VALUES.includes(value);
}

module.exports = {
    BET_COLLECTION,
    BET_VISIBILITY,
    BET_RESOLUTION_METHOD,
    BET_STATUS,
    VALID_VISIBILITY_VALUES,
    VALID_RESOLUTION_METHOD_VALUES,
    VALID_STATUS_VALUES,
    isValidVisibility,
    isValidResolutionMethod,
    isValidStatus,
};
