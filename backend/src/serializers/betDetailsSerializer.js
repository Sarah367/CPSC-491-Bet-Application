// The fields a client may see for a single Bet (SCRUM-98). Used by GET /api/bets/:id and
// by the join response, so both return the same shape.
//
// This is an explicit allowlist: a field stored on a Bet is only sent to clients if it's
// listed here. That keeps fields like participantUids (every participant's uid) private,
// and means a new field added to Firestore later isn't exposed by accident.
const BET_DETAILS_FIELDS = Object.freeze([
    "id",
    "title",
    "description",
    "outcomeA",
    "outcomeB",
    "creatorUid",
    "creatorDisplayName",
    "creatorSide",
    "deadline",
    "outcomeDeadline",
    "visibility",
    "resolutionMethod",
    "status",
    "participantCount",
    "sideACount",
    "sideBCount",
    // What's at stake, so someone deciding whether to join can see it. A monetary Bet has
    // stakeAmountCents and currency; a non-monetary Bet has stakeDescription instead.
    "stakeType",
    "stakeAmountCents",
    "currency",
    "stakeDescription",
]);

// Builds the client-safe version of a Bet from the full object getBetById returns.
// Fields that aren't set on this Bet (like currency on a non-monetary Bet) are left out.
function serializeBetDetails(bet) {
    const details = {};
    for (const field of BET_DETAILS_FIELDS) {
        if (bet[field] !== undefined) {
            details[field] = bet[field];
        }
    }
    return details;
}

module.exports = { BET_DETAILS_FIELDS, serializeBetDetails };
