/**
 * SCRUM-15 scratch check — not wired into app.js (that is SCRUM-16's job).
 *
 * Verifies that the Admin SDK credentials in backend/.env actually reach our
 * real Firebase project by looking up a UID.
 *
 * Usage, from backend/:
 *   node scripts/checkFirebaseAdmin.js <uid>
 *   node scripts/checkFirebaseAdmin.js --email someone@example.com
 *
 * Grab a UID (or email) from Firebase Console > Authentication > Users.
 */
require("dotenv").config({ quiet: true });

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error("Usage: node scripts/checkFirebaseAdmin.js <uid>");
        console.error("       node scripts/checkFirebaseAdmin.js --email <email>");
        process.exit(1);
    }

    const byEmail = args[0] === "--email";
    const lookup = byEmail ? args[1] : args[0];

    if (!lookup) {
        console.error("Missing value after --email.");
        process.exit(1);
    }

    // Required after the argument check so a usage mistake does not surface as
    // a config stack trace.
    let app;
    let auth;
    try {
        ({ app, auth } = require("../src/config/firebaseAdmin"));
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }

    console.log(`Connected to Firebase project: ${app.options.credential.projectId}`);

    const user = byEmail
        ? await auth.getUserByEmail(lookup)
        : await auth.getUser(lookup);

    console.log("Lookup succeeded:");
    console.log({
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        disabled: user.disabled,
        createdAt: user.metadata.creationTime,
    });
}

main().catch((err) => {
    if (err.code === "auth/user-not-found") {
        console.error(
            "Credentials work, but no user matched. The Admin SDK reached Firebase — " +
            "just try a UID or email that exists in this project."
        );
    } else {
        console.error(`Check failed: ${err.message}`);
    }
    process.exit(1);
});
