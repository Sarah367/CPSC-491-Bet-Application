# CI (GitHub Actions)

`ci.yml` runs automatically on every push and pull request targeting `main`. It exists to catch broken code before it merges — nobody needs to run these checks by hand, but this doc explains what's running and how to fix it when it goes red.

## What it checks

Three independent jobs run in parallel:

| Job | Steps | Node | Runs from |
|---|---|---|---|
| **Build Identifier** | generates a unique ID for the run: `build-<run number>-<short commit SHA>` (e.g. `build-42-a1b2c3d`), shown in the run's summary | — | repo root |
| **Backend** | install deps → `npm test` (Jest) → `npm audit --audit-level=high` | 22 | `backend/` |
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
- **Security updates** are enabled in the repo's **Settings → Code security** (SCRUM-75), not in `dependabot.yml`. When GitHub publishes an advisory that affects one of our dependencies **and a patched version exists**, Dependabot should open a fix PR right away instead of waiting for the weekly run. It didn't for either advisory in SCRUM-89, so don't wait for it (see [Vulnerability response](#vulnerability-response)).

Security updates don't replace the audit gate above. When an advisory has **no patched version**, Dependabot can't open a fix PR, and `npm audit` will still fail CI. Fix those manually by following [Vulnerability response](#vulnerability-response). If no patched version exists anywhere in the dependency chain, removing or replacing the package that pulls it in may be the only option (for example, SCRUM-60 replaced `nodemon` with `node --watch` because no patched `braces` version existed).

**Handling a Dependabot security PR:**

1. Read the linked advisory and the package's release notes, and check whether it's a major version bump.
2. Wait for CI to pass (tests, lint, build, and audit).
3. Approve and merge.
4. Merge `main` into any open feature branches so they pick up the fix: `git fetch origin` → `git merge origin/main` → `git push`.

If a Dependabot PR conflicts with `main`, comment `@dependabot rebase` on the PR instead of fixing it by hand.

## Daily security audit

`security-audit.yml` runs the same `npm audit --audit-level=high` check on main once a day at 15:00 UTC (8:00 AM Pacific during daylight time, 7:00 AM otherwise), for both `backend` and `frontend`. It only reads `package-lock.json`, so it doesn't install packages and finishes in a few seconds.

**Why it exists:** new advisories are published all the time, so main can become "vulnerable" overnight without any code changing. Before this workflow, we only found out when the next PR's CI failed, and by then every open PR was failing at once. The daily run shows the problem on its own, so someone can start a fix PR right away.

**What it doesn't do:** it doesn't run on pull requests and never blocks a merge. The audit inside `ci.yml` is still what checks PRs.

**How it fits with Dependabot:** Dependabot security updates should open fix PRs automatically when a patched version exists. The daily audit catches the rest, like advisories with no patch yet, or ones Dependabot hasn't opened a PR for.

**Running it by hand:** go to the **Actions** tab, click **Daily Security Audit**, then **Run workflow**. GitHub only shows this button, and only runs the schedule, once the workflow file is on main.

**If it fails:** follow [Vulnerability response](#vulnerability-response).

## Vulnerability response

What to do when a **high or critical** npm advisory shows up, from any source: a failed audit step on a PR or on main, the [daily security audit](#daily-security-audit), a [Dependabot security PR](#dependabot-version-updates-vs-security-updates), or running `npm audit` yourself. Moderate and low findings don't fail CI and don't need this procedure.

### Quick checklist

1. **Check main.** Run `npm audit --audit-level=high` in the failing folder on an up-to-date `main`. If main fails too, it's a newly published advisory, not your PR.
2. **Announce it in Discord** before starting, so two people don't open the same fix.
3. **Create a Jira chore ticket** with the advisory link and package, and a branch from the latest `main`.
4. **Fix it with the safest option** (see below). Never run `npm audit fix --force`.
5. **Check it:** both audits pass, plus the normal tests, lint, and build.
6. **Open the PR and ask for a quick review.** Every PR is blocked until it merges.
7. **After it merges, update open branches** with `main`.

### Who handles it, and how fast

Whoever notices it first triages it and announces it in Discord. If nobody has picked it up within 1 business day, the owner of SCRUM-91 (CC7.1 monitoring) follows up.

| Target | Time |
|---|---|
| Triage: confirm it's real, record it, and announce it | Within **1 business day** of detection |
| Open a remediation ticket or PR, when a compatible fix exists | Within **2 business days** of detection |

There's no formal target for merging, but treat these PRs as the team's top review priority.

### Choosing a fix

Run `npm audit` to see the package, the fixed version, and the dependency path that pulls it in. Then use the first option that works:

1. **A normal `npm audit fix`**, without `--force`. Usually this only changes `package-lock.json` (SCRUM-89).
2. **Upgrade the package**, or for a transitive dependency, upgrade the direct package that brings it in.
3. **An npm `overrides` entry**, only if no fixed parent version exists. Leave a comment explaining why, so it can be removed later.
4. **Replace or remove the package**, if no patched version exists anywhere (SCRUM-60 replaced `nodemon` with `node --watch`).

**Never run `npm audit fix --force`.** It can install breaking major versions or downgrades. For example, it once suggested downgrading Jest 30 to 25. Any `--force` change needs the team's review first.

Keep the PR small: a branch from current `main`, ideally only lockfile changes, and no unrelated work. Don't change CI to hide the failure (no `|| true`, and no `npm audit fix` inside CI).

### Before merging

- `npm audit --audit-level=high` passes in **both** `backend/` and `frontend/`.
- Backend: `npm test`. Frontend: `npm run lint`, `npm test`, and `npm run build`.
- The advisory no longer appears in `npm audit`.

### Evidence to keep (for SCRUM-91)

Jira and GitHub record most of this automatically: the failed CI run shows when it was detected, the Jira ticket shows when it was triaged, and the PR shows when the fix was opened and merged. Just make sure the Jira ticket includes the advisory link, the package, its severity, and a link to the failed run, and links to the fix PR.

### If no compatible fix exists

Record an exception in the Jira ticket with the package, the advisory, its severity, whether our app actually uses the vulnerable code, any temporary workaround, why no fix is available, who's following up, and when to check again. Keep watching for a fix through the daily audit and Dependabot.

### After the fix merges

1. Confirm the audit passes on `main`.
2. Merge `main` into every open branch: `git fetch origin`, `git merge origin/main`, then push. **Re-running an old PR's CI isn't enough**, because the branch still has the old lockfile until it gets the new `main`.
3. For stacked branches, update the **bottom** branch first, then merge it into the branches above it.
4. Resolve any conflicts locally and run the checks again before pushing.

### Example: SCRUM-89 (October 2026)

| Step | What happened |
|---|---|
| Detection | Oct 23: the audit step failed on an unrelated PR (#61, SCRUM-55) |
| Scope | `main` failed too: `body-parser` (backend) and `zod` (frontend), both high |
| Triage and remediation opened | Same day: created SCRUM-89 and opened PR #62 |
| Fix | A normal `npm audit fix`, with only the two lockfiles changed |
| Check | Both audits clean, and all backend and frontend checks passed |
| Merge | Oct 26 |
| Follow-up | Merged `main` into every open branch, starting with the bottom of each stack |
| Lesson | A second fix PR was opened for the same advisories, so the procedure now says to announce in Discord first |

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
- **Audit failure** — a dependency has a known high or critical vulnerability. Follow [Vulnerability response](#vulnerability-response). If the step failed because the npm registry was unreachable (a network error rather than a vulnerability report), just re-run the job.

## Changing the workflow

Edit `.github/workflows/ci.yml` directly. A few things to keep in mind:

- Each job's `working-directory` default is set once at the job level — steps inside it don't need `cd`.
- If a step needs an env var (API key, config value), add it under that step's `env:` block rather than making it a repo default, unless every job needs it.
- Real secrets (not dummy test values) belong in the repo's **Settings → Secrets and variables → Actions**, referenced as `${{ secrets.NAME }}` — never commit them into the YAML.