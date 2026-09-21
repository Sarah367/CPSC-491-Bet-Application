const { Timestamp } = require("firebase-admin/firestore");
const { db } = require("../config/firebaseAdmin");
const { BET_COLLECTION, BET_VISIBILITY } = require("../models/betModel");

function toIsoString(value) {
    return value instanceof Timestamp ? value.toDate().toISOString() : value;
}

function serializeBet(doc) {
    const data = doc.data();
    return {
        id: doc.id,
        title: data.title,
        deadline: toIsoString(data.deadline),
        visibility: data.visibility,
        status: data.status,
        creatorUid: data.creatorUid,
        createdAt: toIsoString(data.createdAt),
    };
}

// Sorted in memory (rather than an orderBy in the query) so this simple listing
// doesn't require a Firestore composite index on (visibility, createdAt).
async function listPublicBets() {
    const snapshot = await db
        .collection(BET_COLLECTION)
        .where("visibility", "==", BET_VISIBILITY.PUBLIC)
        .get();

    return snapshot.docs
        .map(serializeBet)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = { listPublicBets };
