const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const requireVerifiedEmail = require("../middleware/requireVerifiedEmail");
const { createBet } = require("../controllers/betController");

const router = express.Router();

// order matters: authenticate first, then check verification, then run the controller.
router.post("/", authMiddleware, requireVerifiedEmail, createBet);

module.exports = router;