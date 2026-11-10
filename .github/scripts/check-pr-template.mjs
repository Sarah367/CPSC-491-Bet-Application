// SCRUM-100: fail a PR whose template wasn't filled in.
//
// Run by .github/workflows/pr-template.yml with the PR's title and body in
// the PR_TITLE / PR_BODY env vars. Tests: node --test .github/scripts/check-pr-template.test.mjs

import { pathToFileURL } from 'node:url';

const TICKET = /SCRUM-\d+/g;
const TICKED_BOX = /^\s*[-*]\s+\[[xX]\]/m;

// Template text inside <!-- --> isn't shown on GitHub, so it doesn't count
// as filled in.
function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

// Returns the text between `start` and the first of `ends` after it, or null
// if `start` isn't in the body.
function section(body, start, ends) {
  const from = body.indexOf(start);
  if (from === -1) return null;
  const rest = body.slice(from + start.length);
  const to = Math.min(...ends.map((e) => rest.indexOf(e)).filter((i) => i !== -1), rest.length);
  return rest.slice(0, to);
}

export function checkPrTemplate({ title = '', body = '' }) {
  const errors = [];
  const text = stripComments(body ?? '');

  const bodyTickets = new Set(text.match(TICKET) ?? []);
  if (bodyTickets.size === 0) {
    errors.push('No Jira ticket. Fill in the "**Jira:** SCRUM-<number>" line.');
  }

  // Catches the PR #53 case: template copied from another PR, wrong ticket.
  const titleTickets = title.match(TICKET) ?? [];
  const missing = titleTickets.filter((t) => !bodyTickets.has(t));
  if (bodyTickets.size > 0 && missing.length > 0) {
    errors.push(
      `The title references ${missing.join(', ')} but the body only lists ` +
        `${[...bodyTickets].join(', ')}. Make the "**Jira:**" line match the ticket this PR is for.`,
    );
  }

  const typeOfChange = section(text, '**Type of change:**', ['## Testing checklist']);
  const testing = section(text, '## Testing checklist', ['**Tests added or changed:**', '\n## ']);

  if (typeOfChange === null || testing === null) {
    errors.push(
      'The PR template is missing. Paste .github/pull_request_template.md into the description and fill it in.',
    );
  } else {
    if (!TICKED_BOX.test(typeOfChange)) {
      errors.push('No "Type of change" box is ticked.');
    }
    if (!TICKED_BOX.test(testing)) {
      errors.push('No box in the "Testing checklist" is ticked.');
    }
  }

  return errors;
}

// CLI entry point, used by the workflow.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = checkPrTemplate({
    title: process.env.PR_TITLE ?? '',
    body: process.env.PR_BODY ?? '',
  });

  if (errors.length === 0) {
    console.log('PR template is filled in.');
  } else {
    for (const e of errors) console.log(`::error title=PR template incomplete::${e}`);
    console.log('\nEdit the PR description to fix these. The check re-runs automatically when you save.');
    console.log('See "Reviewing a PR" in CONTRIBUTING.md.');
    process.exitCode = 1;
  }
}
