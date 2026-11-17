/**
 * SCRUM-55 one-time backfill.
 *
 * joinBet only checks whether a Draft should become Active when someone joins.
 * Bets that already had someone on both sides before auto-activation existed
 * (older data) would stay Draft until another person joined. This script finds
 * those Drafts and activates them, using the same rule as joinBet
 * (shouldActivateBet).
 *
 * Usage, from backend/:
 *   node scripts/activateReadyDrafts.js           # dry run: lists what would change
 *   node scripts/activateReadyDrafts.js --apply   # writes the changes
 *
 * Missing counts are treated as 0, matching how FieldValue.increment and
 * joinBet treat them. Each Bet is re-checked inside a transaction before it's
 * updated, so a Bet that changed since the query isn't activated by mistake.
 */
require("dotenv").config({ quiet: true });

function countsOf(bet) {
    return {
        status: bet.status,
        participantCount: bet.participantCount ?? 0,
        sideACount: bet.sideACount ?? 0,
        sideBCount: bet.sideBCount ?? 0,
    };
}

async function main() {
    const apply = process.argv.includes("--apply");

    // Required here so a config problem shows a clear message, not a stack trace.
    let db;
    try {
        ({ db } = require("../src/config/firebaseAdmin"));
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
    const { BET_COLLECTION, BET_STATUS, shouldActivateBet } = require("../src/models/betModel");

    const drafts = await db.collection(BET_COLLECTION).where("status", "==", BET_STATUS.DRAFT).get();
    const ready = drafts.docs.filter((doc) => shouldActivateBet(countsOf(doc.data())));

    console.log(`Checked ${drafts.size} Draft Bet(s); ${ready.length} already meet the activation rule.`);
    for (const doc of ready) {
        const { participantCount, sideACount, sideBCount } = countsOf(doc.data());
        console.log(`  ${doc.id}: ${participantCount} participant(s), A=${sideACount}, B=${sideBCount}`);
    }

    if (!apply) {
        if (ready.length > 0) {
            console.log("Dry run, nothing written. Re-run with --apply to activate these Bets.");
        }
        return;
    }

    let activated = 0;
    for (const doc of ready) {
        const changed = await db.runTransaction(async (transaction) => {
            const snap = await transaction.get(doc.ref);
            if (!snap.exists || !shouldActivateBet(countsOf(snap.data()))) {
                return false;
            }
            transaction.update(doc.ref, { status: BET_STATUS.ACTIVE });
            return true;
        });
        if (changed) {
            activated += 1;
        } else {
            console.log(`  Skipped ${doc.id}: it changed since the check.`);
        }
    }
    console.log(`Activated ${activated} Bet(s).`);
}

main().catch((err) => {
    console.error(`Backfill failed: ${err.message}`);
    process.exit(1);
});
