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
    shouldActivateBet,
} = require("../models/betModel");
const { BetJoinError, JOIN_ERROR } = require("../errors/betJoinError");
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

// bets can be joined while they are a Draft or Active 
const JOINABLE_STATUSES = [BET_STATUS.DRAFT, BET_STATUS.ACTIVE];
 
// Adds the user to a public Bet on the chosen side. Everything happens in one Firestore
// transaction, so two quick requests can't create two participant records or wrong counts.
// Firestore requires every read in a transaction to happen before any write.
// The uid always comes from the verified token (the controller passes req.user.uid).
// If this join gives the Bet people on both sides, it also moves a Draft to Active
// (SCRUM-55), in the same transaction, so the join and the activation happen together.
async function joinBet(betId, uid, side) {
    const betRef = db.collection(BET_COLLECTION).doc(betId);
    const participantRef = betRef.collection(BET_PARTICIPANTS_SUBCOLLECTION).doc(uid);

    await db.runTransaction(async (transaction) => {
        // Reads first.
        const betSnap = await transaction.get(betRef);
        const participantSnap = await transaction.get(participantRef);
 
        if (!betSnap.exists) {
            throw new BetJoinError(JOIN_ERROR.NOT_FOUND, "Bet not found.");
        }
 
        const bet = betSnap.data();
 
        // Private Bets look the same as missing ones, so their existence isn't revealed.
        if (bet.visibility !== BET_VISIBILITY.PUBLIC) {
            throw new BetJoinError(JOIN_ERROR.NOT_FOUND, "Bet not found.");
        }
 
        if (bet.creatorUid === uid) {
            throw new BetJoinError(JOIN_ERROR.CREATOR, "You created this Bet and are already a participant.");
        }
 
        if (participantSnap.exists) {
            throw new BetJoinError(JOIN_ERROR.ALREADY_JOINED, "You have already joined this Bet.");
        }
 
        // Fail closed: a missing or invalid deadline means the Bet can't be joined.
        const deadlineMs = bet.deadline instanceof Timestamp ? bet.deadline.toMillis() : NaN;
        const isOpen = JOINABLE_STATUSES.includes(bet.status) && Date.now() < deadlineMs;
        if (!isOpen) {
            throw new BetJoinError(JOIN_ERROR.CLOSED, "This Bet is no longer accepting participants.");
        }

        transaction.set(participantRef, {
            uid,
            side,
            role: BET_PARTICIPANT_ROLE.PARTICIPANT,
            termsAcknowledged: true,
            joinedAt: FieldValue.serverTimestamp(),
        });
 
        const updates = {
            participantUids: FieldValue.arrayUnion(uid),
            participantCount: FieldValue.increment(1),
            [side === BET_SIDE.A ? "sideACount" : "sideBCount"]: FieldValue.increment(1),
        };

        const shouldActivate = shouldActivateBet({
            status: bet.status,
            participantCount: bet.participantCount + 1,
            sideACount: bet.sideACount + (side === BET_SIDE.A ? 1 : 0),
            sideBCount: bet.sideBCount + (side === BET_SIDE.B ? 1 : 0),
        });

        if (shouldActivate) {
            updates.status = BET_STATUS.ACTIVE;
        }

        transaction.update(betRef, updates);
    });
 
    return getBetById(betId);
}

// Returns the current user's participation in a Bet ({ side, role }), or null if they haven't joined.
async function getViewerParticipation(betId, uid) {
    const snap = await db
        .collection(BET_COLLECTION)
        .doc(betId)
        .collection(BET_PARTICIPANTS_SUBCOLLECTION)
        .doc(uid)
        .get();
 
    if (!snap.exists) {
        return null;
    }
 
    const { side, role } = snap.data();
    return { side, role };
}

module.exports = {
    createBet,
    getBetById,
    getBetsByCreator,
    listPublicBets,
    joinBet,
    getViewerParticipation,
};