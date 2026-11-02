const { Timestamp } = require("firebase-admin/firestore");
const { BET_PARTICIPANT_ROLE } = require("../models/betModel");

// The only stored Bet fields GET /api/bets/mine sends to the client (SCRUM-57).
// My Bets and Home's Recent Bets only use these. It's an explicit allowlist, so
// participantUids, termsAcknowledged, and any field added to Bets later stay on
// the server unless someone adds them here on purpose.
const MY_BET_FIELDS = Object.freeze([
    "title",
    "status",
    "visibility",
    "stakeType",
    "stakeAmountCents",
    "currency",
    "stakeDescription",
]);

function toIsoString(value) {
    return value instanceof Timestamp ? value.toDate().toISOString() : value ?? null;
}

// Turns a Firestore Bet document into a My Bets list item for the given viewer.
// viewerRole is worked out here from creatorUid, so creatorUid itself isn't sent.
function serializeMyBet(doc, viewerUid) {
    const data = doc.data();
    const bet = { id: doc.id };

    for (const field of MY_BET_FIELDS) {
        if (data[field] !== undefined) {
            bet[field] = data[field];
        }
    }

    bet.deadline = toIsoString(data.deadline);
    bet.createdAt = toIsoString(data.createdAt);
    bet.viewerRole = data.creatorUid === viewerUid
        ? BET_PARTICIPANT_ROLE.CREATOR
        : BET_PARTICIPANT_ROLE.PARTICIPANT;

    return bet;
}

module.exports = {
    MY_BET_FIELDS,
    serializeMyBet,
};