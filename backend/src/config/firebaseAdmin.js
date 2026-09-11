const fs = require("fs");
const path = require("path");
const { initializeApp, getApps, getApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

// Resolve the service account path relative to the backend/ root so that both
// "./secrets/key.json" and an absolute path work the same way.
const BACKEND_ROOT = path.resolve(__dirname, "..", "..");

function loadServiceAccount() {
    const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (!configuredPath) {
        throw new Error(
            "FIREBASE_SERVICE_ACCOUNT_PATH is not set. Copy backend/.env.example to " +
            "backend/.env and point it at your Firebase service account JSON key."
        );
    }

    const resolvedPath = path.resolve(BACKEND_ROOT, configuredPath);

    if (!fs.existsSync(resolvedPath)) {
        throw new Error(
            `Firebase service account key not found at ${resolvedPath} ` +
            `(FIREBASE_SERVICE_ACCOUNT_PATH="${configuredPath}"). Download the key from ` +
            "Firebase Console > Project settings > Service accounts. Do not commit it."
        );
    }

    let raw;
    try {
        raw = fs.readFileSync(resolvedPath, "utf8");
    } catch (err) {
        throw new Error(
            `Could not read the Firebase service account key at ${resolvedPath}: ${err.message}`
        );
    }

    let serviceAccount;
    try {
        serviceAccount = JSON.parse(raw);
    } catch (err) {
        throw new Error(
            `The Firebase service account key at ${resolvedPath} is not valid JSON: ${err.message}`
        );
    }

    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
        throw new Error(
            `The file at ${resolvedPath} does not look like a Firebase service account key ` +
            "(missing project_id, client_email or private_key)."
        );
    }

    return serviceAccount;
}

// Guard against re-initializing when this module is required from several places.
const app = getApps().length === 0
    ? initializeApp({ credential: cert(loadServiceAccount()) })
    : getApp();

const auth = getAuth(app);

module.exports = { app, auth };
