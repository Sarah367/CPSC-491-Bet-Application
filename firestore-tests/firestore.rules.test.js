// Automated tests for firestore.rules (SCRUM-102).
//
// Policy (SCRUM-33): clients get no direct access to Firestore at all. Every read
// and write goes through the Express backend, which uses the Firebase Admin SDK and
// isn't affected by security rules. These tests prove the rules deny every direct
// client path, replacing the manual Rules Playground check from #82.
//
// They run only against the local Firestore emulator, started by `npm test` with the
// demo- project ID below, so they never contact a real Firebase project and need no
// credentials. withSecurityRulesDisabled() is used only to seed test data into the
// emulator; it is a test fixture, not a test of the backend's Admin SDK.
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { after, before, beforeEach, describe, it } = require("node:test");
const {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
} = require("firebase/firestore");

// Must match --project in package.json's test script.
const PROJECT_ID = "demo-bet-rules";

// The real rules file at the repo root, so these tests always check what gets deployed.
const RULES_PATH = path.join(__dirname, "..", "firestore.rules");

const USER_UID = "someUid";

let testEnv;

before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
            rules: readFileSync(RULES_PATH, "utf8"),
        },
    });
});

beforeEach(async () => {
    await testEnv.clearFirestore();
});

after(async () => {
    if (testEnv) {
        await testEnv.cleanup();
    }
});

function signedOutDb() {
    return testEnv.unauthenticatedContext().firestore();
}

function signedInDb(uid = USER_UID) {
    return testEnv.authenticatedContext(uid).firestore();
}

// Writes a document with the rules turned off, so every denial below is about access,
// not about the document being missing.
async function seed(docPath, data) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), docPath), data);
    });
}

const BET_PATH = "bets/anyBetId";
const PARTICIPANT_PATH = `bets/anyBetId/participants/${USER_UID}`;

const betData = {
    title: "Will it rain on Friday?",
    creatorUid: "creator-uid",
    visibility: "public",
    status: "draft",
};

const participantData = {
    uid: USER_UID,
    side: "A",
    role: "participant",
    termsAcknowledged: true,
};

describe("test setup", () => {
    it("can seed data with the rules turned off, and a signed-in client still can't read it", async () => {
        await seed(BET_PATH, betData);

        await testEnv.withSecurityRulesDisabled(async (context) => {
            const snap = await assertSucceeds(getDoc(doc(context.firestore(), BET_PATH)));
            if (!snap.exists()) {
                throw new Error("Seeded Bet should exist in the emulator.");
            }
        });

        await assertFails(getDoc(doc(signedInDb(), BET_PATH)));
    });
});

describe("bets/{betId}", () => {
    beforeEach(async () => {
        await seed(BET_PATH, betData);
    });

    it("denies a get when signed out", async () => {
        await assertFails(getDoc(doc(signedOutDb(), BET_PATH)));
    });

    it("denies a get when signed in", async () => {
        await assertFails(getDoc(doc(signedInDb(), BET_PATH)));
    });

    it("denies a create when signed in", async () => {
        await assertFails(setDoc(doc(signedInDb(), "bets/newBetId"), betData));
    });

    it("denies a query of the bets collection when signed in", async () => {
        await assertFails(getDocs(collection(signedInDb(), "bets")));
    });
});

describe("bets/{betId}/participants/{participantUid}", () => {
    beforeEach(async () => {
        await seed(PARTICIPANT_PATH, participantData);
    });

    it("denies a get, even for the participant's own record", async () => {
        await assertFails(getDoc(doc(signedInDb(USER_UID), PARTICIPANT_PATH)));
    });

    it("denies an update, even for the participant's own record", async () => {
        await assertFails(updateDoc(doc(signedInDb(USER_UID), PARTICIPANT_PATH), { side: "B" }));
    });
});

describe("every other path (catch-all rule)", () => {
    it("denies a get of /users/someUid", async () => {
        await seed(`users/${USER_UID}`, { displayName: "Test User" });

        await assertFails(getDoc(doc(signedInDb(), `users/${USER_UID}`)));
    });

    it("denies a delete of a nested document", async () => {
        await seed("anything/x/nested/y", { value: 1 });

        await assertFails(deleteDoc(doc(signedInDb(), "anything/x/nested/y")));
    });
});
