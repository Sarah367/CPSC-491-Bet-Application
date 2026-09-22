const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const {db} = require("../config/firebaseAdmin");
const { BET_COLLECTION, BET_STATUS, BET_STAKE_TYPE } = require("../models/betModel");

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

module.exports = { createBet };