# CI (GitHub Actions)

`ci.yml` runs automatically on every push and pull request targeting `main`. It exists to catch broken code before it merges — nobody needs to run these checks by hand, but this doc explains what's running and how to fix it when it goes red.

## What it checks

Two independent jobs run in parallel:

| Job | Steps | Runs from |
|---|---|---|
| **Backend** | install deps → `npm test` (Jest) | `backend/` |
| **Frontend** | install deps → `npm run lint` (ESLint) → `npm test` (Vitest) → `npm run build` (Vite) | `frontend/` |

Both use Node 20. Either job failing marks the check red on the PR.

## Where to see results

- On a PR: scroll to the checks section at the bottom, or the ✅/❌ next to the latest commit
- Full logs: the **Actions** tab on GitHub → click the workflow run → click a job to expand its steps

## Running the same checks locally

Do this before pushing so CI isn't the first place you find out something's broken:

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

If `npm test` or `npm run build` fails locally with a Firebase error (`auth/invalid-api-key`), you're missing `frontend/.env` — see the root `README.md` for setup. CI itself doesn't need this: it sets dummy `VITE_FIREBASE_*` values as env vars on the test step, since the tests mock Firebase's auth calls and never talk to a real project.

## Common failures

- **Lint errors** — read the rule name in the error (e.g. `react-refresh/only-export-components`, `no-unused-vars`); ESLint's message tells you exactly what and where.
- **Test failures** — reproduce with `npm test` locally; the Vitest/Jest output points at the failing assertion.
- **Build failure** — usually a real error the dev server was silently tolerating; run `npm run build` locally to see the same output CI sees.

## Changing the workflow

Edit `.github/workflows/ci.yml` directly. A few things to keep in mind:

- Each job's `working-directory` default is set once at the job level — steps inside it don't need `cd`.
- If a step needs an env var (API key, config value), add it under that step's `env:` block rather than making it a repo default, unless every job needs it.
- Real secrets (not dummy test values) belong in the repo's **Settings → Secrets and variables → Actions**, referenced as `${{ secrets.NAME }}` — never commit them into the YAML.
