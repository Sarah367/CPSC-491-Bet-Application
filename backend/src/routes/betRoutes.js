const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { createBet, listMyBets, listPublicBets } = require("../controllers/betController");

const router = express.Router();

router.post("/", authMiddleware, createBet);

// Static paths like /mine and /public must stay registered above any future /:id route,
// otherwise Express would match "mine" or "public" as an id.
router.get("/mine", authMiddleware, listMyBets);
router.get("/public", authMiddleware, listPublicBets);

module.exports = router;
