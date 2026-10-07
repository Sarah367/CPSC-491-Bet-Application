const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const requireVerifiedEmail = require("../middleware/requireVerifiedEmail");
const { createBet, listMyBets } = require("../controllers/betController");

const router = express.Router();

// order matters: authenticate first, then check verification, then run the controller.
router.post("/", authMiddleware, requireVerifiedEmail, createBet);

// Static paths like /mine must stay registered above any future /:id route,
// otherwise Express would match "mine" as an id.
router.get("/mine", authMiddleware, listMyBets);

module.exports = router;