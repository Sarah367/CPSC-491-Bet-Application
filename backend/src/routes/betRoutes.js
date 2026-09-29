const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { createBet, listMyBets } = require("../controllers/betController");

const router = express.Router();

router.post("/", authMiddleware, createBet);

// Static paths like /mine must stay registered above any future /:id route,
// otherwise Express would match "mine" as an id.
router.get("/mine", authMiddleware, listMyBets);

module.exports = router;