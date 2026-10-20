const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const requireVerifiedEmail = require("../middleware/requireVerifiedEmail");
const { createBet, listMyBets, listPublicBets, getBetById } = require("../controllers/betController");
const router = express.Router();

// order matters: authenticate first, then check verification, then run the controller.
router.post("/", authMiddleware, requireVerifiedEmail, createBet);

// Static paths like /mine and /public must stay registered above the /:id route below,
// otherwise Express would match "mine" or "public" as an id.
// Viewing Bets only requires login; the spec requires verification for creating and joining.
router.get("/mine", authMiddleware, listMyBets);
router.get("/public", authMiddleware, listPublicBets);
router.get("/:id", authMiddleware, getBetById);

module.exports = router;