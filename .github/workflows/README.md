# CI (GitHub Actions)

`ci.yml` runs automatically on every push and pull request targeting `main`. It exists to catch broken code before it merges — nobody needs to run these checks by hand, but this doc explains what's running and how to fix it when it goes red.

## What it checks

Three independent jobs run in parallel:

| Job | Steps | Node | Runs from |
|---|---|---|---|
| **Build Identifier** | generates a unique ID for the run: `build-<run number>-<short commit SHA>` (e.g. `build-42-a1b2c3d`), shown in the run's summary | — | repo root |
| **Backend** | install deps → `npm test` (Jest) → `npm audit --audit-level=high` | 20 | `backend/` |
| **Frontend** | install deps → `npm run lint` (ESLint) → `npm test` (Vitest) → `npm run build` (Vite) → `npm audit --audit-level=high` | 22 | `frontend/` |

Any job failing marks the check red on the PR.

## Dependency audit (security gate)

Both the backend and frontend jobs end with `npm audit --audit-level=high`, which checks every installed package (including dev tools like Vite, ESLint, Vitest, and Jest) against npm's database of known vulnerabilities.

- **High or critical** vulnerability found → the job **fails**.
- **Moderate, low, or info** → still printed in the log for visibility, but the job **passes**.

**Why `high`:** high and critical findings are treated as merge-blocking security issues. Lower severities stay visible for review without blocking work, since many come from transitive dependencies we can't fix directly. For example, when this gate was added (September 2026), the backend reported 6 moderate findings through `firebase-admin`'s dependencies and 0 high/critical; the frontend reported 0.

**Why it runs last:** each job only takes about a minute, so auditing first would save very little time. Running it last means a newly published advisory never hides lint/test/build results, so reviewers can tell a code failure apart from a dependency-advisory failure. The step also has `if: ${{ !cancelled() }}`, so it still runs (and reports) when an earlier step fails.

**Heads up:** the audit checks the *current* advisory database, so a commit that passed yesterday can fail today if a new vulnerability is published, even though no code changed. That's expected, not a CI bug.

### Dependabot: version updates vs. security updates

Dependabot runs in two separate ways in this repo:

- **Version updates** are configured in `.github/dependabot.yml` (SCRUM-49). Once a week, Dependabot opens grouped PRs that bump minor and patch versions in `backend/` and `frontend/`. This is routine maintenance.
- **Security updates** are enabled in the repo's **Settings → Code security** (SCRUM-75), not in `dependabot.yml`. When GitHub publishes an advisory that affects one of our dependencies **and a patched version exists**, Dependabot opens a fix PR right away instead of waiting for the weekly run.

Security updates don't replace the audit gate above. When an advisory has **no patched version**, Dependabot can't open a fix PR, and `npm audit` will still fail CI. Fix those manually using the steps under **Audit failure** in [Common failures](#common-failures). If no patched version exists anywhere in the dependency chain, removing or replacing the package that pulls it in may be the only option (for example, SCRUM-60 replaced `nodemon` with `node --watch` because no patched `braces` version existed).

**Handling a Dependabot security PR:**

1. Read the linked advisory and the package's release notes, and check whether it's a major version bump.
2. Wait for CI to pass (tests, lint, build, and audit).
3. Approve and merge.
4. Merge `main` into any open feature branches so they pick up the fix: `git fetch origin` → `git merge origin/main` → `git push`.

If a Dependabot PR conflicts with `main`, comment `@dependabot rebase` on the PR instead of fixing it by hand.

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
- **Audit failure** — a dependency has a known high/critical vulnerability. Run `npm audit` locally to see the package, severity, and the dependency path that pulls it in. Then:
  1. If it's a direct dependency, upgrade it (`npm audit` usually names the fixed version).
  2. If it's transitive, upgrade the direct package that brings it in first. Only use an npm `overrides` entry if no fixed parent version exists, and leave a comment explaining why so it can be removed later.
  3. Run the tests/lint/build again and commit the updated `package-lock.json` through a normal PR.

  Don't run `npm audit fix` inside CI or add `|| true` to the audit step. CI should detect problems, not silently change dependencies or hide failures. If the step fails because the npm registry is unreachable (a network error rather than a vulnerability report), just re-run the job.

## Changing the workflow

Edit `.github/workflows/ci.yml` directly. A few things to keep in mind:

- Each job's `working-directory` default is set once at the job level — steps inside it don't need `cd`.
- If a step needs an env var (API key, config value), add it under that step's `env:` block rather than making it a repo default, unless every job needs it.
- Real secrets (not dummy test values) belong in the repo's **Settings → Secrets and variables → Actions**, referenced as `${{ secrets.NAME }}` — never commit them into the YAML.
