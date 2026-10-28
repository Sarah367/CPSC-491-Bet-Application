// Error thrown by betService.joinBet when a Bet can't be joined. It lives in its own file
// so the controller can use it even when tests mock betService.
// The controller maps each code to an HTTP status, so the service never deals with HTTP.
const JOIN_ERROR = Object.freeze({
    NOT_FOUND: "not_found",
    CREATOR: "creator_cannot_join",
    ALREADY_JOINED: "already_joined",
    CLOSED: "bet_closed",
});
 
class BetJoinError extends Error {
    constructor(code, message) {
        super(message);
        this.name = "BetJoinError";
        this.code = code;
    }
}
 
module.exports = { BetJoinError, JOIN_ERROR };