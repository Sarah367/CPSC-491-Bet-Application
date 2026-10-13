<!--
Title format: SCRUM-<number>: <short description>
See CONTRIBUTING.md for the testing policy this checklist is based on.
-->

**Jira:** SCRUM-

This PR accomplishes the following:

-

**Type of change:**

- [ ] Feature
- [ ] Bug fix
- [ ] Tests only
- [ ] Chore (CI, dependencies, docs, refactor)

## Testing checklist

- [ ] I added or updated tests for this change (or explained below why none are needed)
- [ ] **Bug fix only:** I added a regression test that fails without the fix and passes with it
- [ ] No `.only` or `.skip` left in any test file
- [ ] Tests mock Firebase and never contact a real Firebase project
- [ ] I ran the same checks CI runs, locally, and they pass:
  - Backend: `npm test`
  - Frontend: `npm run lint`, `npm test`, `npm run build`
- [ ] CI is green: `Backend (Jest)` and `Frontend (Lint, Vitest, Build)`

**Tests added or changed:**

-

**If no tests were added, why:**

<!-- e.g. "docs only", "CSS only, no behavior change". Delete if tests were added. -->

If **TESTING** this PR:

1. Make sure you are on Node 22 or newer: `node -v`
2. Check out the branch: `git checkout <branch-name>`
3.
