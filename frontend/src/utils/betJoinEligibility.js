// bets can be joined while they are a draft or active, matching the backend (SCRUM-54)
const JOINABLE_STATUSES = [
    "draft",
    "active"
];

// Whether the current user could join this Bet right now. The backend makes the final
// decision; this only decides whether to show the Join section.
// `now` is passed in so tests can control the time.
export function canJoinBet({ bet, uid, viewerParticipation, now = Date.now() }) {
    if (!bet || !uid) {
        return false;
    }
 
    const deadlineMs = new Date(bet.deadline).getTime();
 
    return (
        bet.visibility === "public" &&
        JOINABLE_STATUSES.includes(bet.status) &&
        bet.creatorUid !== uid &&
        viewerParticipation == null &&
        // A missing or invalid deadline gives NaN, so this is false and the Bet can't be joined.
        now < deadlineMs
    );
}
 
// The text of the outcome for a side ("A" or "B"), falling back to "Side A"/"Side B".
export function outcomeForSide(bet, side) {
    const outcome = side === "A" ? bet?.outcomeA : bet?.outcomeB;
    return outcome || `Side ${side}`;
}