const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { createBet, listPublicBets } = require("../controllers/betController");

const router = express.Router();

router.post("/", authMiddleware, createBet);
router.get("/public", authMiddleware, listPublicBets);

module.exports = router;
