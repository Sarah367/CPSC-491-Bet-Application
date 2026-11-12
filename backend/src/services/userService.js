const { FieldValue } = require("firebase-admin/firestore");
const { db, auth } = require("../config/firebaseAdmin");

// User profiles (SCRUM-87). Each user can have a document at users/{uid}, where the
// document ID is their Firebase uid. It stores only what other users may see:
//   displayName  the name shown to other users, for example as a Bet's creator
//   createdAt    when the profile was first saved
//   updatedAt    when it was last changed
// It never stores the email or anything secret. Clients can't read Firestore directly
// (see firestore.rules), so all reads and writes go through this backend.
const USERS_COLLECTION = "users";

// Firebase Auth's getUsers() accepts at most 100 users per call.
const AUTH_LOOKUP_BATCH_SIZE = 100;

// Saves the user's display name in both places that hold it: Firebase Auth (which
// the signed-in browser reads) and the users/{uid} profile (which the backend reads
// to show names on Bets). The two can't be updated in one transaction, so Auth is
// updated first. If the profile write then fails, the caller gets an error, and the
// next successful save brings both back in line.
async function updateDisplayName(uid, displayName) {
    await auth.updateUser(uid, { displayName: displayName });

    const profileRef = db.collection(USERS_COLLECTION).doc(uid);
    await db.runTransaction(async (transaction) => {
        const profileDoc = await transaction.get(profileRef);

        const profile = {
            displayName: displayName,
            updatedAt: FieldValue.serverTimestamp(),
        };
        // createdAt is only set the first time, so it keeps the original date.
        if (!profileDoc.exists) {
            profile.createdAt = FieldValue.serverTimestamp();
        }

        transaction.set(profileRef, profile, { merge: true });
    });

    return { displayName: displayName };
}

// Returns true when a value is a display name worth showing.
function isUsableName(value) {
    if (typeof value !== "string") {
        return false;
    }
    if (value.trim() === "") {
        return false;
    }
    return true;
}

// Looks up display names for a list of uids (duplicates and empty values are fine).
// Returns an object mapping each uid to its name, or to null when there isn't one.
//
// 1. One Firestore read for all the users/{uid} profiles at once.
// 2. For users without a profile (for example, accounts that set their name before
//    profiles existed), one Firebase Auth lookup per 100 users.
// Any lookup that fails just leaves those names as null, so a lookup problem never
// fails the request that needed the names.
async function resolveDisplayNames(uids) {
    const names = {};
    const uniqueUids = [];
    for (const uid of uids) {
        if (typeof uid === "string" && uid !== "" && !(uid in names)) {
            names[uid] = null;
            uniqueUids.push(uid);
        }
    }

    // db.getAll() throws if it's given nothing to read.
    if (uniqueUids.length === 0) {
        return names;
    }

    let missingUids = [];
    try {
        const profileRefs = [];
        for (const uid of uniqueUids) {
            profileRefs.push(db.collection(USERS_COLLECTION).doc(uid));
        }

        const profileDocs = await db.getAll(...profileRefs);
        for (const profileDoc of profileDocs) {
            let profileName = null;
            if (profileDoc.exists) {
                profileName = profileDoc.data().displayName;
            }

            if (isUsableName(profileName)) {
                names[profileDoc.id] = profileName;
            } else {
                missingUids.push(profileDoc.id);
            }
        }
    } catch (error) {
        console.error("[userService] Failed to read user profiles: ", error);
        missingUids = uniqueUids;
    }

    for (let start = 0; start < missingUids.length; start += AUTH_LOOKUP_BATCH_SIZE) {
        const identifiers = [];
        const batch = missingUids.slice(start, start + AUTH_LOOKUP_BATCH_SIZE);
        for (const uid of batch) {
            identifiers.push({ uid: uid });
        }

        try {
            const result = await auth.getUsers(identifiers);
            for (const userRecord of result.users) {
                if (isUsableName(userRecord.displayName)) {
                    names[userRecord.uid] = userRecord.displayName;
                }
            }
        } catch (error) {
            console.error("[userService] Failed to look up display names in Firebase Auth: ", error);
        }
    }

    return names;
}

// The display name for one user, or null when there isn't one. Used for a single Bet
// (Bet Details): it reads the user's profile, and only asks Firebase Auth when there's
// no usable name in the profile. Any lookup that fails just returns null.
async function resolveDisplayName(uid) {
    if (typeof uid !== "string" || uid === "") {
        return null;
    }

    try {
        const profileDoc = await db.collection(USERS_COLLECTION).doc(uid).get();
        if (profileDoc.exists) {
            const profileName = profileDoc.data().displayName;
            if (isUsableName(profileName)) {
                return profileName;
            }
        }
    } catch (error) {
        console.error("[userService] Failed to read user profile: ", error);
    }

    try {
        const userRecord = await auth.getUser(uid);
        if (isUsableName(userRecord.displayName)) {
            return userRecord.displayName;
        }
    } catch (error) {
        console.error("[userService] Failed to look up display name in Firebase Auth: ", error);
    }

    return null;
}

module.exports = {
    USERS_COLLECTION,
    AUTH_LOOKUP_BATCH_SIZE,
    updateDisplayName,
    resolveDisplayNames,
    resolveDisplayName,
};
