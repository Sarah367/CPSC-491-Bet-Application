// Whether the current user can edit this Bet right now, using the same rule as the backend
// (SCRUM-36): they created it, it's still a Draft, nobody else has joined, and joining is still open.
// The backend makes the final decision; this only decides whether to show the Edit button and form.
// `now` is passed in so tests can control the time.
export function canEditBet({ bet, uid, now = Date.now() }) {
    if (!bet || !uid) {
        return false;
    }
 
    const deadlineMs = new Date(bet.deadline).getTime();
 
    return (
        bet.creatorUid === uid &&
        bet.status === "draft" &&
        bet.participantCount === 1 &&
        // A missing or invalid deadline gives NaN, so this is false and the Bet can't be edited.
        now < deadlineMs
    );
}