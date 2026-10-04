const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const {db} = require("../config/firebaseAdmin");
const { 
    BET_COLLECTION,
    BET_PARTICIPANTS_SUBCOLLECTION, 
    BET_STATUS, 
    BET_STAKE_TYPE,
    BET_SIDE,
    BET_PARTICIPANT_ROLE,
} = require("../models/betModel");
// Creates a Bet and its creator's participant record in one atomic batch, so a Bet can never
// exist without its creator as participant #1 (or vice versa). The controller has already
// validated every argument, including that the creator acknowledged the terms.
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

    return { id: betRef.id, ...savedDoc.data()};
}

module.exports = { createBet };