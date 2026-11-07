import { apiGet } from "./apiClient";

// Fetches every Bet marked as public, for the discovery-oriented listing view.
export async function fetchPublicBets() {
    const data = await apiGet("/bets/public");
    return data.bets;
}

export async function fetchMyBets() {
    const data = await apiGet("/bets/mine");
    return data?.bets ?? [];
}
