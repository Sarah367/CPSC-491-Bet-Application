# Backend integration tests

HTTP-level tests that send real requests to the Express app with
[Supertest](https://github.com/ladjs/supertest). Unlike the unit tests in
`backend/tests/`, which test one piece at a time, these check the whole request
path: routing, `express.json()`, middleware, controllers, and response codes.

## Conventions

- Location: `backend/tests/integration/`
- File names: `<area>.integration.test.js` (e.g. `bets.integration.test.js`)
- Import the app from `src/app.js`, never `src/server.js`. `app.js` exports the
  Express app without calling `listen()`, so Supertest can call it directly
  without starting a server or using a port.
- Always mock `src/config/firebaseAdmin` with `jest.mock(...)` so tests never
  contact the real Firebase project and don't need a service account key.
  Control authentication by setting `auth.verifyIdToken` to resolve with a
  decoded token (e.g. `{ uid: "test-uid", email_verified: true }`) or reject.

## Running

From `backend/`:

```bash
npm test                                   # all tests, unit + integration
npx jest tests/integration                 # integration tests only
npx jest tests/integration/api.integration.test.js   # one file
```

They run in CI automatically: the backend job already runs `npm test`, and Jest
picks up every `*.test.js` file.

## Covered endpoints

Every route registered in `src/app.js` is listed here. When you add, change, or
remove a route, update this table in the same PR.

| Endpoint | Guards | File | Success | Auth / error | Invalid input |
|---|---|---|---|---|---|
| `GET /api/health` | none | `api.integration.test.js` | 200 `{ status: "ok" }`, no token checked | n/a (public) | n/a (no input) |
| `GET /api/protected` | auth | `api.integration.test.js` | 200 with uid from the token | 401 missing header, 401 rejected token | n/a (no input) |
| `POST /api/bets` | auth, verified email | `bets.create.integration.test.js`, `auth-verification.integration.test.js` | 201 monetary, 201 non-monetary, trimming, side counts | 401 missing / malformed / rejected token, 401 checked before 403, 403 unverified, 403 claim absent, 403 ignores spoofed body / header verification, 500 Firestore failure without leaking details | 400 for each missing, blank, or non-string required field, duplicate outcomes, invalid enums, `termsAcknowledged`, past deadline, outcome deadline not after deadline, invalid dates, monetary and non-monetary stake rules, malformed JSON, array body, non-JSON body; server-controlled fields ignored |
| `GET /api/bets/mine` | auth | `bets.read.integration.test.js` | 200 own Bets incl. private, ISO dates, empty list, newest first | 401 missing / rejected token, 500 Firestore failure without leaking details | spoofed `uid` / `creatorUid` in query, body, and header are ignored |
| `GET /api/bets/public` | auth | `bets.read.integration.test.js` | 200 public Bets from any creator, only the 7 listing fields, empty list, newest first | 401 missing / rejected token, 500 Firestore failure without leaking details | n/a (no input) |
| unknown routes | none | `api.integration.test.js` | n/a | 404 | n/a |

Not implemented yet, so not tested: Bet Details (`GET /api/bets/:id`, SCRUM-32,
still on its feature branch), bet editing (SCRUM-36), join / participants,
lifecycle transitions, outcome resolution / voting, history and stats, payouts,
and notifications.

## Adding tests for a new endpoint

Only add tests once the endpoint is merged to `main`. Each new endpoint needs, at
minimum:

- [ ] at least one successful case
- [ ] at least one authorization or error case (401 / 403 / 404 / 500, whichever apply)
- [ ] at least one invalid-input case (400), when the endpoint takes input
- [ ] **Editing:** a non-creator gets 403 and nothing is written; the creator succeeds
- [ ] **Lifecycle transitions:** every allowed transition (`draft → active → locked →
      resolved → archived`) succeeds, and rejected ones (e.g. skipping a state, going
      backwards, changing a resolved Bet) are refused without a write
- [ ] **`/:id` routes:** an unknown id returns 404, and the static `/mine` and
      `/public` routes still resolve correctly (they must stay registered above `/:id`)
- [ ] a row in the table above

If an API contract changes on purpose, update the assertions that encode the old
contract in the same PR and say why in the PR description (CONTRIBUTING.md, rule 3).
Don't delete or loosen a test just because it went red.

## Stability checks before the final demo

The suite must pass locally and in CI before the final demo / release. To check
that it doesn't depend on test order or leave anything running:

```bash
npx jest tests/integration --randomize          # shuffled order (prints the seed)
npx jest tests/integration --randomize --seed=<seed>   # replay a failing order
npx jest tests/integration --detectOpenHandles  # nothing left open after tests
```

Dates that go through deadline validation must be relative to `Date.now()`.
Fixed dates are fine only where the test checks formatting or sorting, as in
`bets.read.integration.test.js`.

## Known gaps

Documented here so they aren't silently omitted. Each should become a Jira
ticket if the team decides to fix it.

- **Malformed JSON returns HTML, not our JSON error shape.** `express.json()`
  rejects the body before any route runs, so Express's default error handler sends
  a 400 HTML page. This also happens before authentication, so an unauthenticated
  request with bad JSON gets 400 instead of 401. Outside `NODE_ENV=production`,
  that page includes a stack trace. The test asserts only the 400 status and that
  nothing reached authentication or Firestore. Fix: add a JSON error-handling
  middleware in `app.js`, then tighten the test.
- **Unknown routes return an HTML 404**, not `{ error, message }` JSON. The
  test asserts only the status.
- **Firestore is mocked, not emulated.** These tests check the HTTP contract and
  which queries are run, not real Firestore behavior (indexes, Security Rules,
  transactions). That needs the Firebase Emulator Suite, which isn't set up yet.
- **No real Firebase Auth tokens.** Token verification is mocked, so token
  expiry, revocation, and custom-claim behavior are covered only by Firebase's
  own guarantees.
- **`GET /api/bets/public` lists Bets of every status**, including `draft`.
  The tests lock in the current behavior; if the listing should hide drafts or
  closed Bets, that is a product decision and the test should change with it.
