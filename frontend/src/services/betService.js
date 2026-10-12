import { apiGet } from "./apiClient";

// Fetches every Bet marked as public, for the discovery-oriented listing view.
export async function fetchPublicBets() {
    const data = await apiGet("/bets/public");
    return data.bets;
}
