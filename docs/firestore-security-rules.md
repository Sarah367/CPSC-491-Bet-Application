# Firestore Security Rules (SCRUM-33)

The rules in `firestore.rules` (repo root) deny **all** direct client access to Firestore. The backend is unaffected because it uses the Firebase Admin SDK, which bypasses security rules.

> **Committing `firestore.rules` does nothing on its own.** The rules only take effect after someone runs `firebase deploy --only firestore:rules` (see [Deploying](#deploying)).

## What the rules do

| Path | read | write |
|------|:----:|:-----:|
| `bets/{betId}` | denied | denied |
| `bets/{betId}/participants/{participantUid}` | denied | denied |
| `/{document=**}` (everything else) | denied | denied |

`bets` and `participants` match `BET_COLLECTION` and `BET_PARTICIPANTS_SUBCOLLECTION` in `backend/src/models/betModel.js`. The catch-all already covers them, but the explicit matches make the intended Bet paths obvious and give a future ticket a clear place to change them.

## Assumptions

These rules are correct only while all of the following hold. If any of them change, revisit the rules.

1. **The frontend never talks to Firestore directly.** All data access goes through `frontend/src/services/apiClient.js` → Express backend. As of SCRUM-33 the frontend no longer initializes the Firestore client at all (`getFirestore` and `db` were removed from `frontend/src/services/firebase.js`). The frontend only uses Firebase **Auth**.
2. **The backend uses the Admin SDK** (`backend/src/config/firebaseAdmin.js`), which bypasses rules. Nothing in the backend relies on rules for authorization.
3. **Authorization lives in the backend, only there:**
   - `backend/src/middleware/authMiddleware.js`: verifies the Firebase ID token, sets `req.user`
   - `backend/src/middleware/requireVerifiedEmail.js`: blocks unverified accounts
   - `backend/src/controllers/betController.js`: private-bet visibility, creator ownership, join conditions
   - `backend/src/services/betService.js`: `serializeBetDoc` / `serializeBet` control which fields leave the API (SCRUM-98 adds `betDetailsSerializer`)

   This logic is intentionally **not** duplicated in rules syntax. A second copy would drift from `betController` while guarding an access path nothing uses.

### Why a deny-all backstop is still needed

The Firebase web config (`VITE_FIREBASE_*`) is public by design: Vite inlines every `VITE_` variable into the built JS bundle. Anyone can read the project ID and API key from the site and build their own client against this project. Without rules, that client could read or write Firestore directly and skip every backend check. These rules close that path.

### Adding direct client access later

Firestore grants access if **any** matching rule allows it. The catch-all `allow ... if false` does **not** override a more specific `allow ... if <condition>`. A feature that needs direct client access (for example realtime `onSnapshot` listeners) must change these rules **in its own ticket**, with its own review. Don't work around them (for example by reading through an unrelated, more permissive path).

## Deploying

Requires the Firebase CLI (`npm install -g firebase-tools`) and access to the Firebase project. The repo has no `.firebaserc`, so pass the project explicitly:

```bash
firebase login
firebase deploy --only firestore:rules --project <firebase-project-id>
```

`--only firestore:rules` deploys only the rules. It doesn't touch indexes, hosting, or functions. `firebase.json` points the CLI at `firestore.rules`.

You can also paste the contents of `firestore.rules` into **Firebase Console → Firestore Database → Rules** and click **Publish**. If you do, make sure the Console version matches the committed file, or the next CLI deploy will overwrite it.

## Verifying (Rules Playground)

Automated rules tests (`@firebase/rules-unit-testing`) are intentionally not used. They need the Firestore emulator (and Java), which CI doesn't have, and CONTRIBUTING.md requires tests to be deterministic and never contact a real Firebase project.

Verify manually after deploying, in **Firebase Console → Firestore Database → Rules → Rules Playground**:

| # | Simulation type | Location | Authenticated | Expected |
|---|-----------------|----------|:-------------:|----------|
| 1 | get | `/bets/anyBetId` | No | ❌ Denied |
| 2 | get | `/bets/anyBetId` | Yes (any UID) | ❌ Denied |
| 3 | create | `/bets/anyBetId` | Yes | ❌ Denied |
| 4 | get | `/bets/anyBetId/participants/someUid` | Yes, UID = `someUid` | ❌ Denied |
| 5 | update | `/bets/anyBetId/participants/someUid` | Yes, UID = `someUid` | ❌ Denied |
| 6 | get | `/users/someUid` (any other path) | Yes | ❌ Denied |
| 7 | delete | `/anything/x/nested/y` | Yes | ❌ Denied |

Every case should be denied. Then confirm the backend still works (Admin SDK bypasses rules): sign in through the app, then create, list, view, and join a bet as usual.
