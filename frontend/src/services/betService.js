import { apiGet, apiPost } from "./apiClient";

// Fetches every Bet marked as public, for the discovery-oriented listing view.
export async function fetchPublicBets() {
    const data = await apiGet("/bets/public");
    return data.bets;
}

// Fetches the Bets the user created or joined, newest first. Pass a limit to get only
// the newest few (SCRUM-106); with no limit, it returns all of them.
export async function fetchMyBets(limit) {
    const path = limit === undefined
        ? "/bets/mine"
        : `/bets/mine?limit=${encodeURIComponent(limit)}`;
    const data = await apiGet(path);
    return data?.bets ?? [];
}

// joins a public Bet on the chosen side 
// Returns { message, bet, viewerParticipation }, where bet is the updated Bet re-read
// by the server after joining. Errors are passed through as ApiError so the page can
// show a different message for each status (403, 404, 409, and so on).
export async function joinBet(betId, {side, termsAcknowledged}) {
    return apiPost(`/bets/${encodeURIComponent(betId)}/join`, {side, termsAcknowledged});
}
