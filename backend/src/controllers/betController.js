const betService = require("../services/betService");

// GET /api/bets/public - requires authMiddleware to have already run.
// Returns every Bet marked as public, regardless of who created it.
async function listPublicBets(req, res) {
    try {
        const bets = await betService.listPublicBets();

        return res.status(200).json({ bets });
    } catch (error) {
        console.error("[betController] Failed to list public bets: ", error);
        return res.status(500).json({
            error: "server_error",
            message: "Unable to list public bets.",
        });
    }
}

module.exports = { listPublicBets };
