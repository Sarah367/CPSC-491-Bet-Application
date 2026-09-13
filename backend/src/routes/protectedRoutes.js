const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Example route only: proves authMiddleware attaches to a route and populates
// req.user. Real feature routes come later.
router.get("/", authMiddleware, (req,res) => {
    res.status(200).json({
        message: "Authenticated",
        uid: req.user.uid,
    });
});

module.exports = router;
