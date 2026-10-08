const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const {db} = require("../config/firebaseAdmin");
const { BET_COLLECTION, BET_STATUS, BET_STAKE_TYPE, BET_VISIBILITY } = require("../models/betModel");

async function createBet({
    title,
    description,
    creatorUid,
    deadline,
    visibility,
    resolutionMethod,
    stakeType,
    stakeAmountCents,
    currency,
    stakeDescription,
}) {
    const betData = {
        title,
        description,
        creatorUid,
        createdAt: FieldValue.serverTimestamp(), // created server-side, never accepted from a caller
        deadline: Timestamp.fromDate(deadline),
        visibility,
        resolutionMethod,
        status: BET_STATUS.DRAFT,
        stakeType,
        ...(stakeType === BET_STAKE_TYPE.MONETARY
            ? { stakeAmountCents, currency }
            : { stakeDescription }),
    };

    const docRef = await db.collection(BET_COLLECTION).add(betData);

    // FieldValue.serverTimestamp() isn't resolved to real value until after write completes, so 
    // re-read document to get the actual stored value. 
    const savedDoc = await docRef.get();

    return { id: docRef.id, ...savedDoc.data()};
}


// Firestore Timestamps serialize to {_seconds, _nanoseconds} in JSON, so convert
// them to ISO strings before a Bet leaves the backend.
function timestampToIso(value) {
    return value instanceof Timestamp ? value.toDate().toISOString() : value ?? null;
}
 
function serializeBetDoc(doc) {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        createdAt: timestampToIso(data.createdAt),
        deadline: timestampToIso(data.deadline),
    };
}
 
// Returns every Bet created by the given uid, newest first. Sorted in memory
// rather than with orderBy in the query, because combining where(creatorUid)
// with orderBy(createdAt) requires a Firestore composite index.
async function getBetsByCreator(uid) {
    const snapshot = await db
        .collection(BET_COLLECTION)
        .where("creatorUid", "==", uid)
        .get();
 
    return snapshot.docs
        .map(serializeBetDoc)
        .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}
 
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
 
module.exports = { createBet, getBetsByCreator, listPublicBets };