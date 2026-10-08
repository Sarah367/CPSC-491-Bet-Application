function requireVerifiedEmail(req,res,next) {
    if (req.user?.email_verified !== true) {
        return res.status(403).json({
            error: "email_not_verified",
            message: "Please verify your email before creating or joining bets.",
        });
    }
    return next();
}

module.exports = requireVerifiedEmail;