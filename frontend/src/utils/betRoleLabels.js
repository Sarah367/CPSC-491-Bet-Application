// GET /api/bets/mine returns Bets the user created or joined, each with a
// viewerRole from the server (SCRUM-57). Unknown roles show no label.
export const ROLE_LABELS = {
    creator: "You created this Bet",
    participant: "You joined this Bet",
};
