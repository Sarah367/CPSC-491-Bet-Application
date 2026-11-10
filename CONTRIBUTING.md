# Contributing

## Testing policy

Every PR into `main` runs the full automated test suite in CI (see [`.github/workflows/README.md`](.github/workflows/README.md)). That suite is our regression net: each passing test locks in behavior that already works, so a change that breaks it is caught before it merges. These rules keep that net reliable.

### Where tests go

| Area | Location | Runner |
|---|---|---|
| Backend unit tests | `backend/tests/*.test.js` | Jest |
| Backend API integration tests | `backend/tests/integration/*.integration.test.js` (Supertest, see its [README](backend/tests/integration/README.md)) | Jest |
| Frontend tests | next to the file they test, e.g. `src/pages/LoginPage.test.jsx` | Vitest + React Testing Library |

Any file ending in `.test.js` / `.test.jsx` is picked up by `npm test` automatically, locally and in CI. No CI changes are needed to add tests.

### Rules

1. **New behavior comes with tests.** Features add tests for the happy path and for the main invalid inputs and error codes (400, 401, 403, 404, 500 where they apply).
2. **Bug fixes come with a regression test.** Write a test that reproduces the bug and fails without your fix, then passes with it. That bug can't come back without CI going red.
3. **Don't make a red check green by weakening tests.** Don't delete, skip, or loosen an assertion just to pass CI. If a test is wrong because the intended behavior changed, update it and say why in the PR.
4. **No `.only` or `.skip` in merged code.** Vitest already fails in CI on `.only`, but Jest does not, so reviewers should check for it.
5. **Never silence a CI step.** No `|| true`, `continue-on-error`, or `npm audit fix` inside the workflow. See the workflows README for how to fix an audit failure properly.
6. **Tests must be deterministic.** Mock Firebase (`jest.mock` / `vi.mock`) and never contact a real Firebase project. Use dates relative to now (e.g. "7 days from now") instead of fixed dates that will eventually be in the past.

### Flaky tests

If a check fails and you believe it's flaky (not caused by your change), re-run the job once. If it fails again, treat it as a real failure. If a test really is flaky, open a Jira ticket to fix it. Don't skip it.

### Before opening a PR

Run the same checks CI runs:

```bash
# backend
cd backend
npm test

# frontend
cd frontend
npm run lint
npm test
npm run build
```

Then fill in the PR template's testing checklist.

## Reviewing a PR

The PR template is our record of what changed, which Jira ticket it was for,
and how it was tested. It only works if it's actually filled in.

**Don't approve a PR until its template is complete.** Before approving, check:

1. **The Jira ticket is filled in and correct.** The `**Jira:**` line has a real
   `SCRUM-<number>`, and it's the ticket this PR actually implements, matching
   the title. Open the ticket if you're not sure. A template copied from another
   PR often still has the old ticket.
2. **"Type of change" has a box ticked.**
3. **Every testing checklist box that applies is ticked.** For an item that
   doesn't apply (like the regression test on a feature), the author should say
   why under "If no tests were added, why", not just leave it blank.
4. **The summary says what the PR does.** "This PR accomplishes the following"
   isn't left as an empty `-`.

If something's missing, request changes and say what. Don't approve it and
trust that the author will fix it later. This applies to every reviewer, and
to PRs from any teammate. Dependabot PRs are the only exception, since they
don't use the template.

### The `PR template filled in` check

`.github/workflows/pr-template.yml` checks the parts a script can check, and
fails the PR if:

- the description has no `SCRUM-<number>`,
- no "Type of change" box or no "Testing checklist" box is ticked, or
- the title names a ticket (e.g. `SCRUM-71: ...`) that isn't anywhere in the
  description.

It re-runs automatically when the description is edited, so fixing the
description turns it green without a new commit. A green check doesn't replace
the review above, though. The script can't tell whether the ticket is the right
one when the title has none, or whether the ticked boxes are true.

## Secrets and credentials

### What secrets exist

| Secret | Where it lives | Actually secret? |
|---|---|---|
| Firebase service account key (JSON) | `backend/secrets/`, local only | **Yes.** Full admin access to Firestore and Auth, bypassing all security rules. |
| `backend/.env` | Each developer's machine | Yes — it points at the service account key path. |
| `frontend/.env` (`VITE_FIREBASE_*`) | Each developer's machine | **No.** See below. |

**The frontend Firebase config is not a secret.** Vite inlines every `VITE_`
variable into the JavaScript bundle, so the API key, auth domain and project ID
are visible to anyone who opens the site. That's how Firebase is designed to
work: the web API key identifies the project, it doesn't authorize anything.
What actually protects the data is Firebase Authentication and Firestore
security rules. We still keep `frontend/.env` out of Git so each developer can
point at their own project, but leaking it is not a credential incident.

**The backend service account key is a real secret.** It authenticates as the
project itself, bypasses every security rule, and can read or delete any
document. Treat it like a password.

### Rules

- Never commit a secret. `.gitignore` covers `.env`, `.env.local`, `secrets/`,
  and the service account key under any of its common filenames
  (`*serviceAccount*.json`, `*service-account*.json`, `*firebase-adminsdk*.json`).
- Never paste a secret into Discord, a PR comment, a Jira ticket, a Google Doc,
  or a screenshot. Chat history is not a secure store and screenshots are easy
  to forget about.
- Never send the service account key as a file attachment.
- `.env.example` is committed and must only ever contain placeholder values.

### Getting set up as a new teammate

1. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to
   `frontend/.env`.
2. Ask the repository owner for the Firebase project access. You generate your
   own service account key rather than receiving someone else's: Firebase
   Console → Project settings → Service accounts → Generate new private key.
3. Save the downloaded JSON to `backend/secrets/`. Don't rename it into the
   repo root, and don't move it outside the ignored folder.
4. Point `GOOGLE_APPLICATION_CREDENTIALS` in `backend/.env` at that file.
5. Confirm it works: `node scripts/checkFirebaseAdmin.js` from `backend/`.
6. Confirm Git doesn't see it: `git status` should show nothing new.

Each developer having their own key means a single leaked key can be revoked
without disrupting anyone else.

### Rotating the service account key

Do this if a key is committed, pasted anywhere, shared, or if a team member
leaves the project.

1. Firebase Console → Project settings → Service accounts → Generate new
   private key.
2. Every developer replaces their local copy and updates
   `GOOGLE_APPLICATION_CREDENTIALS`.
3. Confirm the backend still starts and `checkFirebaseAdmin.js` passes.
4. **Then** delete the old key in Google Cloud Console → IAM & Admin →
   Service accounts → Keys. Revoke only after the new key is confirmed working,
   or you'll take the backend down.
5. Record it in a Jira ticket: what was exposed, where, when, and when the old
   key was revoked.

Rotating does **not** undo exposure. Anything the key could reach was reachable
for as long as it was exposed, so assume the data was accessible and say so in
the ticket.

### Verifying history is clean

These search every branch and every commit, including files later deleted:

```bash
git log --all --full-history --oneline -- '*.env' '*serviceAccount*' 'backend/secrets/*'
git log --all --oneline -S "BEGIN PRIVATE KEY"
```

Both should return nothing. If something turns up, rotate the key first, then
worry about the history — a key in a deleted file is still a live key.
