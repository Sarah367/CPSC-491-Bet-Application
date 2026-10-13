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
