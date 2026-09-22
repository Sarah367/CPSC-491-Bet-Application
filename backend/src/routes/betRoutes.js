const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { createBet } = require("../controllers/betController");

const router = express.Router();

router.post("/", authMiddleware, createBet);

module.exports = router;