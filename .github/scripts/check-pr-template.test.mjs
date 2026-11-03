import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkPrTemplate } from './check-pr-template.mjs';

// Use the real template so these tests break if it changes in a way the
// check no longer understands.
const template = readFileSync(new URL('../pull_request_template.md', import.meta.url), 'utf8');

function fill(body, ticket = 'SCRUM-100') {
  return body
    .replace('**Jira:** SCRUM-', `**Jira:** ${ticket}`)
    .replace('- [ ] Chore (CI, dependencies, docs, refactor)', '- [x] Chore (CI, dependencies, docs, refactor)')
    .replace('- [ ] No `.only` or `.skip` left in any test file', '- [x] No `.only` or `.skip` left in any test file');
}

test('passes a completed template', () => {
  assert.deepEqual(checkPrTemplate({ title: 'SCRUM-100: require PR template', body: fill(template) }), []);
});

test('fails the empty template, as pasted (PR #53)', () => {
  const errors = checkPrTemplate({ title: 'SCRUM-71: something', body: template });
  assert.equal(errors.length, 3);
  assert.match(errors[0], /No Jira ticket/);
  assert.match(errors[1], /Type of change/);
  assert.match(errors[2], /Testing checklist/);
});

test('fails an empty body', () => {
  const errors = checkPrTemplate({ title: 'SCRUM-100: x', body: '' });
  assert.match(errors.join('\n'), /No Jira ticket/);
  assert.match(errors.join('\n'), /template is missing/);
});

test('handles a null body (GitHub sends null when the description is empty)', () => {
  assert.ok(checkPrTemplate({ title: 'x', body: null }).length > 0);
});

test('fails when the body lists a different ticket than the title (PR #53)', () => {
  const errors = checkPrTemplate({ title: 'SCRUM-71: something', body: fill(template, 'SCRUM-79') });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /title references SCRUM-71/);
});

test('passes when the title has no ticket', () => {
  assert.deepEqual(checkPrTemplate({ title: 'Fix typo', body: fill(template) }), []);
});

test('passes when the body lists several tickets including the title one', () => {
  const body = fill(template, 'SCRUM-56, SCRUM-57');
  assert.deepEqual(checkPrTemplate({ title: 'SCRUM-57: joined bets', body }), []);
});

test('ignores tickets and ticked boxes inside HTML comments', () => {
  const body = template.replace('<!--', '<!-- SCRUM-1 - [x] Feature');
  assert.equal(checkPrTemplate({ title: '', body }).length, 3);
});

test('a ticked box only in "Type of change" is not enough', () => {
  const body = template
    .replace('**Jira:** SCRUM-', '**Jira:** SCRUM-100')
    .replace('- [ ] Feature', '- [x] Feature');
  const errors = checkPrTemplate({ title: 'SCRUM-100: x', body });
  assert.deepEqual(errors, ['No box in the "Testing checklist" is ticked.']);
});

test('accepts an uppercase X', () => {
  const body = fill(template).replace('- [x] Chore', '- [X] Chore');
  assert.deepEqual(checkPrTemplate({ title: '', body }), []);
});

test('handles Windows line endings', () => {
  assert.deepEqual(checkPrTemplate({ title: '', body: fill(template).replace(/\n/g, '\r\n') }), []);
});
