const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { listPublicBets } = require("../controllers/betController");

const router = express.Router();

router.get("/public", authMiddleware, listPublicBets);

module.exports = router;
