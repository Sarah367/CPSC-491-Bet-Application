const userService = require("../services/userService");

// The longest display name allowed, after trimming spaces from both ends.
const DISPLAY_NAME_MAX_LENGTH = 50;
const DISPLAY_NAME_MESSAGE = `displayName must be between 1 and ${DISPLAY_NAME_MAX_LENGTH} characters.`;

// Checks the request body for PUT /api/users/me. Only displayName can be changed.
// Returns { valid: true, displayName } with the name trimmed, or
// { valid: false, message } explaining what's wrong.
function validateProfileUpdate(body) {
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return { valid: false, message: "Request body must be a JSON object." };
    }

    for (const key of Object.keys(body)) {
        if (key !== "displayName") {
            return { valid: false, message: "Only displayName can be updated." };
        }
    }

    if (typeof body.displayName !== "string") {
        return { valid: false, message: DISPLAY_NAME_MESSAGE };
    }

    const displayName = body.displayName.trim();
    if (displayName.length === 0 || displayName.length > DISPLAY_NAME_MAX_LENGTH) {
        return { valid: false, message: DISPLAY_NAME_MESSAGE };
    }

    return { valid: true, displayName: displayName };
}

// PUT /api/users/me (SCRUM-87) - requires authMiddleware to have run first.
// Updates the signed-in user's display name. The uid comes only from the verified
// token, so a uid anywhere in the request is ignored.
async function updateMyProfile(req, res) {
    const result = validateProfileUpdate(req.body);
    if (!result.valid) {
        return res.status(400).json({ error: "invalid_request", message: result.message });
    }

    try {
        const profile = await userService.updateDisplayName(req.user.uid, result.displayName);
        return res.status(200).json({ profile: profile });
    } catch (error) {
        console.error("[userController] Failed to update profile: ", error);
        return res.status(500).json({ error: "server_error", message: "Unable to update your profile." });
    }
}

module.exports = {
    DISPLAY_NAME_MAX_LENGTH,
    validateProfileUpdate,
    updateMyProfile,
};
