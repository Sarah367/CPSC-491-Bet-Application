// Error thrown by betService.updateBet when a Bet can't be edited (SCRUM-36). Like BetJoinError,
// it lives in its own file so the controller can use it even when tests mock betService.
const EDIT_ERROR = Object.freeze({
    // Missing, or not the requester's own Bet. Both look the same, so nobody can learn whether
    // someone else's Bet exists.
    NOT_FOUND: "not_found",
    // The Bet exists and is theirs, but it's past the point where its terms can change.
    NOT_EDITABLE: "bet_not_editable",
    // The Bet with the requested changes applied breaks a Create Bet rule.
    INVALID: "invalid_request",
});
 
class BetEditError extends Error {
    constructor(code, message) {
        super(message);
        this.name = "BetEditError";
        this.code = code;
    }
}
 
module.exports = { BetEditError, EDIT_ERROR };