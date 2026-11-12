const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { updateMyProfile } = require("../controllers/userController");
const router = express.Router();

// SCRUM-87: the signed-in user updates their own profile. Only login is required,
// since unverified users could already change their display name before this.
router.put("/me", authMiddleware, updateMyProfile);

module.exports = router;
