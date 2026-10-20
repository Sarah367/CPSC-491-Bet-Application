const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const {db, auth} = require("../config/firebaseAdmin");
const {
    BET_COLLECTION,
    BET_PARTICIPANTS_SUBCOLLECTION,
    BET_STATUS,
    BET_STAKE_TYPE,
    BET_SIDE,
    BET_PARTICIPANT_ROLE,
    BET_VISIBILITY,
} = require("../models/betModel");
async function createBet({
    title,
    description,
    outcomeA,
    outcomeB,
    creatorUid,
    creatorSide,
    deadline,
    outcomeDeadline,
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
        outcomeA,
        outcomeB,
        creatorUid,
        creatorSide,
        createdAt: FieldValue.serverTimestamp(), // created server-side, never accepted from a caller
        deadline: Timestamp.fromDate(deadline), // when participant closes
        outcomeDeadline: Timestamp.fromDate(outcomeDeadline), // when the result is expected
        visibility,
        resolutionMethod,
        status: BET_STATUS.DRAFT,
        stakeType,
        ...(stakeType === BET_STAKE_TYPE.MONETARY
            ? { stakeAmountCents, currency }
            : { stakeDescription }),
        participantUids: [creatorUid],
        participantCount: 1,
        sideACount: creatorSide === BET_SIDE.A ? 1 : 0,
        sideBCount: creatorSide === BET_SIDE.B ? 1 : 0,
    };
    const creatorParticipantData = {
        uid: creatorUid,
        side: creatorSide,
        role: BET_PARTICIPANT_ROLE.CREATOR,
        termsAcknowledged: true,
        joinedAt: FieldValue.serverTimestamp(),
    }
    // doc() with no argument generates the Bet ID up front, so the participant
    // record can be written under it in the same batch.
    const betRef = db.collection(BET_COLLECTION).doc();
    const participantRef = betRef.collection(BET_PARTICIPANTS_SUBCOLLECTION).doc(creatorUid);

    const batch = db.batch();
    batch.set(betRef, betData);
    batch.set(participantRef, creatorParticipantData);
    await batch.commit();

    // FieldValue.serverTimestamp() isn't resolved to real value until after write completes, so 
    // re-read document to get the actual stored value. 
    const savedDoc = await betRef.get();

    return serializeBetDoc(savedDoc);
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
        outcomeDeadline: timestampToIso(data.outcomeDeadline),
    };
}
 
// Looks up the creator's display name via the Admin SDK. This is a network call
// that can fail for reasons unrelated to the bet (deleted user, auth outage,
// quota) - any failure falls back to null rather than failing the whole request.
// Never falls back to email/uid: those aren't exposed by any endpoint today.
async function resolveCreatorDisplayName(creatorUid) {
    try {
        const userRecord = await auth.getUser(creatorUid);
        return userRecord.displayName ?? null;
    } catch (error) {
        console.error("[betService] Failed to look up creator display name: ", error);
        return null;
    }
}

// Returns a single Bet by id, or null if it doesn't exist. Visibility checks
// (e.g. private bets) are the caller's responsibility, not this function's.
// Adds creatorDisplayName alongside the existing creatorUid; serializeBetDoc
// itself is left untouched since other endpoints reuse it and shouldn't start
// making auth calls.
async function getBetById(id) {
    const doc = await db.collection(BET_COLLECTION).doc(id).get();

    if (!doc.exists) {
        return null;
    }

    const bet = serializeBetDoc(doc);
    const creatorDisplayName = await resolveCreatorDisplayName(bet.creatorUid);

    return { ...bet, creatorDisplayName };
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
 
module.exports = { createBet, getBetById, getBetsByCreator, listPublicBets };