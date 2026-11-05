// Seam 1: the spec check CLI, run from outside the way a skill runs it.
// Each test builds a small fixture repo in a temp directory, runs
// `node skills/aw-check-spec/scripts/check-spec.mjs <dir>` and asserts on the
// exit code and the reported findings only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertNoFindings,
  assertOneFinding,
  checkSpecCli,
  repoRoot,
  runCli,
  writeFiles,
} from './fixtures.mjs';

const SPEC = 'docs/specs/login/spec.md';

// A finding about the login spec whose message matches `pattern`.
const finding = (pattern) => new RegExp(`^docs/specs/login/spec\\.md: .*${pattern.source}`);

// The sections of a valid spec, in template order. Each test replaces or
// drops one to break exactly one rule.
function sections() {
  return {
    'Problem and goal': 'Users cannot sign in.\n',
    'Acceptance criteria':
      '- **AC-1**: Given a registered user, when they sign in, then they see the dashboard.\n' +
      '- **AC-2**: Given a wrong password, when they sign in, then they see an error.\n' +
      '- **AC-3**: Given a locked account, when they sign in, then support is offered.\n',
    'Out of scope': 'Password reset.\n',
    Boundaries: '### Always\n\nRun the tests.\n\n### Ask first\n\nNew dependencies.\n\n### Never\n\nLog passwords.\n',
    Design: 'A form posts to `/session`.\n',
    'Slice plan': '1. [x] Sign-in form (AC-1, AC-2, AC-3). AFK.\n',
    'Test strategy': 'Seam: the HTTP endpoint.\n',
    Traceability:
      '| Acceptance criterion | Evidence |\n| --- | --- |\n' +
      '| AC-1 | test: `tests/login.test.mjs` |\n' +
      '| AC-2 | verify: `docs/specs/login/verify/` |\n' +
      '| AC-3 | manual: support flow needs a staff account we cannot script |\n',
    'Open questions': 'None.\n',
  };
}

function specText({ frontmatter = 'status: implemented\nticket: "#12"\n', parts = sections() } = {}) {
  const body = Object.entries(parts)
    .filter(([, content]) => content !== undefined)
    .map(([heading, content]) => `## ${heading}\n\n${content}`)
    .join('\n');
  return `---\n${frontmatter}---\n\n# Login\n\n${body}`;
}

// A repo holding one valid implemented spec and the evidence it points to.
function validRepo(spec = specText()) {
  return {
    [SPEC]: spec,
    'tests/login.test.mjs': "test('AC-1: a registered user sees the dashboard', () => {});\n",
    'docs/specs/login/verify/ac-2.md': 'Passed.\n',
  };
}

function runOn(files) {
  const dir = mkdtempSync(join(tmpdir(), 'aw-spec-'));
  try {
    writeFiles(dir, files);
    return runCli(checkSpecCli, dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('a repo with a valid spec passes with no findings', () => {
  assertNoFindings(runOn(validRepo()));
});

test('a repo with no specs is reported clearly, not as an error', () => {
  const result = runOn({ 'README.md': 'No specs here.\n' });

  assertNoFindings(result);
  assert.match(result.stderr, /no specs found under docs\/specs\//);
});

// Frontmatter: `status` is one of draft, approved, implemented or superseded;
// `ticket` is optional; `superseded-by` names the replacing spec's slug and
// appears only when the spec is superseded.

test('a spec without frontmatter is reported', () => {
  const repo = validRepo();
  repo[SPEC] = repo[SPEC].replace(/^---\n[\s\S]*?\n---\n/, '');

  assertOneFinding(runOn(repo), finding(/frontmatter/));
});

test('a spec with an unknown status value is reported', () => {
  const repo = validRepo(specText({ frontmatter: 'status: done\n' }));

  assertOneFinding(runOn(repo), finding(/status "done"/));
});

test('a spec whose frontmatter has no status is reported', () => {
  const repo = validRepo(specText({ frontmatter: 'ticket: "#12"\n' }));

  assertOneFinding(runOn(repo), finding(/status/));
});

// A superseded login spec, plus the valid spec that replaces it.
function supersededRepo(frontmatter) {
  return {
    ...validRepo(specText({ frontmatter })),
    'docs/specs/login-v2/spec.md': specText(),
  };
}

test('a superseded spec that names an existing replacement passes', () => {
  assertNoFindings(runOn(supersededRepo('status: superseded\nsuperseded-by: login-v2\n')));
});

test('a superseded spec without superseded-by is reported', () => {
  assertOneFinding(
    runOn(supersededRepo('status: superseded\n')),
    finding(/superseded-by/),
  );
});

test('a superseded-by that names no existing spec is reported', () => {
  assertOneFinding(
    runOn(supersededRepo('status: superseded\nsuperseded-by: login-v3\n')),
    finding(/login-v3/),
  );
});

test('superseded-by on a spec that is not superseded is reported', () => {
  assertOneFinding(
    runOn(supersededRepo('status: implemented\nsuperseded-by: login-v2\n')),
    finding(/superseded-by/),
  );
});

test('a frontmatter field outside status, ticket and superseded-by is reported', () => {
  const repo = validRepo(specText({ frontmatter: 'status: implemented\nowner: sam\n' }));

  assertOneFinding(runOn(repo), finding(/"owner"/));
});

// Sections: every `## <section>` of the template, and the Always, Ask first
// and Never tiers under Boundaries.

test('a spec missing a required section is reported', () => {
  const parts = sections();
  delete parts['Out of scope'];

  assertOneFinding(runOn(validRepo(specText({ parts }))), finding(/"Out of scope"/));
});

test('a section heading that only appears inside a code block is reported as missing', () => {
  const parts = sections();
  delete parts['Test strategy'];
  parts.Design += '\n```markdown\n## Test strategy\n```\n';

  assertOneFinding(runOn(validRepo(specText({ parts }))), finding(/"Test strategy"/));
});

test('Boundaries without its Ask first tier is reported', () => {
  const parts = sections();
  parts.Boundaries = parts.Boundaries.replace('### Ask first\n\nNew dependencies.\n\n', '');

  assertOneFinding(runOn(validRepo(specText({ parts }))), finding(/Boundaries.*"Ask first"/));
});

// Acceptance criteria: each `AC-n` is defined once, as a list item or heading
// in Acceptance criteria, and has a row in the Traceability table.

test('an AC-n defined twice is reported', () => {
  const parts = sections();
  parts['Acceptance criteria'] += '- **AC-2**: Given a typo, when they sign in, then they see an error.\n';

  assertOneFinding(runOn(validRepo(specText({ parts }))), finding(/AC-2.*more than once/));
});

test('an AC-n without a Traceability row is reported', () => {
  const parts = sections();
  parts.Traceability = parts.Traceability.replace(/\| AC-3 \|.*\n/, '');

  assertOneFinding(runOn(validRepo(specText({ parts }))), finding(/AC-3.*Traceability/));
});

test('a Traceability row for an AC-n that is not defined is reported', () => {
  const parts = sections();
  parts.Traceability += '| AC-4 | manual: checked by hand because it is a one-off |\n';

  assertOneFinding(runOn(validRepo(specText({ parts }))), finding(/AC-4/));
});

test('AC-1 is not mistaken for AC-10 in Traceability', () => {
  const parts = sections();
  parts['Acceptance criteria'] += '- **AC-10**: Given a guest, when they open the app, then they see sign-in.\n';
  parts.Traceability = parts.Traceability.replace('| AC-1 |', '| AC-10 |');
  const spec = specText({ frontmatter: 'status: approved\n', parts });

  assertOneFinding(runOn(validRepo(spec)), finding(/AC-1\b.*Traceability/));
});

// Open questions: a list item starting with `BLOCKS:` is an open blocking
// question. Resolving it means recording the answer and changing the prefix to
// `RESOLVED:`. None may stay open from approved on.

function withQuestion(status, question) {
  const parts = sections();
  parts['Open questions'] = `- ${question}\n`;
  return validRepo(specText({ frontmatter: `status: ${status}\n`, parts }));
}

test('an open BLOCKS: question in a draft spec passes', () => {
  assertNoFindings(runOn(withQuestion('draft', 'BLOCKS: which session store?')));
});

test('an open BLOCKS: question in an approved spec is reported', () => {
  assertOneFinding(
    runOn(withQuestion('approved', 'BLOCKS: which session store?')),
    finding(/BLOCKS: which session store\?/),
  );
});

test('an open BLOCKS: question in an implemented spec is reported', () => {
  assertOneFinding(
    runOn(withQuestion('implemented', '**BLOCKS:** which session store?')),
    finding(/which session store\?/),
  );
});

test('a resolved question in an approved spec passes', () => {
  assertNoFindings(runOn(withQuestion('approved', 'RESOLVED: which session store? Redis.')));
});

// Evidence: at implemented, every Traceability row's evidence resolves. Paths
// are relative to the repo root. A cell may hold several entries separated by
// `;` or `<br>`.

function withEvidence(ac, evidence, status = 'implemented') {
  const parts = sections();
  parts.Traceability = parts.Traceability
    .split('\n')
    .map((row) => (row.startsWith(`| ${ac} |`) ? `| ${ac} | ${evidence} |` : row))
    .join('\n');
  return validRepo(specText({ frontmatter: `status: ${status}\n`, parts }));
}

test('a test: file that does not exist is reported', () => {
  assertOneFinding(
    runOn(withEvidence('AC-1', 'test: `tests/logout.test.mjs`')),
    finding(/AC-1.*tests\/logout\.test\.mjs/),
  );
});

test('a test: file that does not mention its AC-n is reported', () => {
  const repo = withEvidence('AC-1', 'test: `tests/login.test.mjs`');
  repo['tests/login.test.mjs'] = "test('AC-10: a guest sees sign-in', () => {});\n";

  assertOneFinding(runOn(repo), finding(/AC-1\b.*tests\/login\.test\.mjs.*mention/));
});

test('a verify: path that does not exist is reported', () => {
  assertOneFinding(
    runOn(withEvidence('AC-2', 'verify: `docs/specs/login/verify/ac-9.md`')),
    finding(/AC-2.*docs\/specs\/login\/verify\/ac-9\.md/),
  );
});

// A verify result as aw-verify records it: the backticked path of the result
// file, then the verify result in parentheses.
test('a verify: entry with its result in parentheses resolves to its path', () => {
  assertNoFindings(runOn(withEvidence('AC-2', 'verify: `docs/specs/login/verify/ac-2.md` (passed)')));
});

test('a verify: entry whose result file does not exist is reported by its path alone', () => {
  assertOneFinding(
    runOn(withEvidence('AC-2', 'verify: `docs/specs/login/verify/ac-9.md` (failed)')),
    finding(/AC-2: verify path "docs\/specs\/login\/verify\/ac-9\.md" does not exist$/),
  );
});

test('a manual: entry without a reason is reported', () => {
  assertOneFinding(runOn(withEvidence('AC-3', 'manual:')), finding(/AC-3.*manual.*reason/));
});

test('an implemented spec with a row that has no evidence is reported', () => {
  assertOneFinding(runOn(withEvidence('AC-3', '')), finding(/AC-3.*no evidence/));
});

test('an implemented spec with evidence of no known kind is reported', () => {
  assertOneFinding(
    runOn(withEvidence('AC-3', 'pending')),
    finding(/AC-3.*"pending".*test:, verify: or manual:/),
  );
});

test('evidence that does not resolve yet passes before implemented', () => {
  assertNoFindings(runOn(withEvidence('AC-1', 'test: `tests/logout.test.mjs`', 'approved')));
});

// Windows: specs edited there may arrive with CRLF endings and backslashes.

const crlf = (text) => text.replace(/\n/g, '\r\n');

test('a valid spec with CRLF line endings passes', () => {
  assertNoFindings(runOn(validRepo(crlf(specText()))));
});

test('a rule violation in a CRLF spec is still reported', () => {
  const parts = sections();
  parts.Traceability = parts.Traceability.replace('| AC-3 |', '| AC-4 |');

  const result = runOn(validRepo(crlf(specText({ frontmatter: 'status: approved\n', parts }))));

  assert.equal(result.status, 1);
  assert.deepEqual(
    result.findings.map((line) => line.replace(/^docs\/specs\/login\/spec\.md: /, '').replace(/[,;:].*$/, '')),
    ['AC-3 has no row in the Traceability table', 'Traceability has a row for AC-4'],
  );
});

test('a test: path with backslashes resolves', () => {
  assertNoFindings(runOn(withEvidence('AC-1', String.raw`test: tests\login.test.mjs`)));
});

test('a test: path with backslashes that does not exist is reported', () => {
  assertOneFinding(
    runOn(withEvidence('AC-1', String.raw`test: tests\logout.test.mjs`)),
    finding(/AC-1.*tests\\logout\.test\.mjs/),
  );
});

test('a cell with several entries checks each one', () => {
  assertOneFinding(
    runOn(withEvidence('AC-1', 'test: `tests/login.test.mjs`; verify: `docs/specs/login/verify/` <br> manual:')),
    finding(/AC-1.*manual.*reason/),
  );
});

test('a spec folder without spec.md is reported', () => {
  const repo = validRepo();
  repo['docs/specs/logout/notes.md'] = 'Not a spec yet.\n';

  assertOneFinding(runOn(repo), /^docs\/specs\/logout: .*spec\.md/);
});

test('the shipped spec template passes as a draft spec', () => {
  const template = readFileSync(join(repoRoot, 'skills', 'aw-check-spec', 'SPEC-TEMPLATE.md'), 'utf8');

  assertNoFindings(runOn({ 'docs/specs/example/spec.md': template }));
});

test('a valid spec saved with a byte-order mark passes', () => {
  assertNoFindings(runOn(validRepo(`\uFEFF${crlf(specText())}`)));
});

test('a spec whose Acceptance criteria defines no AC-n is reported', () => {
  const parts = sections();
  parts['Acceptance criteria'] = 'To be written.\n';
  parts.Traceability = '| Acceptance criterion | Evidence |\n| --- | --- |\n';

  assertOneFinding(runOn(validRepo(specText({ parts }))), finding(/Acceptance criteria defines no AC-n/));
});

test('a manual: reason may contain a semicolon', () => {
  assertNoFindings(runOn(withEvidence('AC-3', 'manual: checked on staging; no test because it needs a staff login')));
});

test('a spec file outside a slug folder is reported', () => {
  assertOneFinding(runOn({ 'docs/specs/login.md': specText() }), /^docs\/specs\/login\.md: .*docs\/specs\/<slug>\/spec\.md/);
});

test('a spec.md that is a folder is reported, not a crash', () => {
  const repo = validRepo();
  repo['docs/specs/logout/spec.md/notes.md'] = 'Not a spec.\n';

  assertOneFinding(runOn(repo), /^docs\/specs\/logout: .*spec\.md/);
});

// The draft aw-spec writes: no ticket line, the slice plan left to aw-slices,
// planned evidence whose files do not exist yet, and no open questions.
test('a draft as aw-spec writes it, before slices and tests exist, passes', () => {
  const parts = sections();
  parts['Slice plan'] = 'Written by `/aw-slices` after spec approval.\n';

  assertNoFindings(runOn({ [SPEC]: specText({ frontmatter: 'status: draft\n', parts }) }));
});

// The approved spec in the shape aw-slices writes it: numbered slices, each
// with its done marker unset, its criteria, AFK or HITL, and sub-items for
// what it delivers, its blockers and its mirror ticket; the agreed seams in
// Test strategy; and planned evidence whose files do not exist yet. The check
// has no rules on the slice plan's content, so this pins only that the shape
// raises no finding.
test('an approved spec with the slice plan and Test strategy aw-slices writes passes', () => {
  const parts = sections();
  parts['Slice plan'] =
    '1. [ ] Lockout rule (AC-3). HITL.\n' +
    '   - Delivers: a locked account is refused and offered support, end to end.\n' +
    '   - Blocked by: none.\n' +
    '   - Mirror: #13\n' +
    '2. [ ] Expand: session token beside the cookie (AC-1). AFK.\n' +
    '   - Delivers: a registered user signs in and reaches the dashboard.\n' +
    '   - Blocked by: 1.\n' +
    '   - Mirror: #14\n' +
    '3. [ ] Migrate: the error page reads the token (AC-2). AFK.\n' +
    '   - Delivers: a wrong password shows an error, read from the token.\n' +
    '   - Blocked by: 2.\n' +
    '   - Mirror: #15\n' +
    '4. [ ] Contract: drop the cookie (AC-1). AFK.\n' +
    '   - Delivers: a registered user still reaches the dashboard; no caller reads the cookie.\n' +
    '   - Blocked by: 3.\n' +
    '   - Mirror: #16\n';
  parts['Test strategy'] =
    'Agreed with the user:\n\n' +
    '- **The HTTP endpoint** (`POST /session`): catches AC-1 and AC-2; misses the rendered page.\n' +
    '- AC-3 is proven by `manual:` evidence: the support flow needs a staff account.\n';

  assertNoFindings(runOn({ [SPEC]: specText({ frontmatter: 'status: approved\nticket: "#12"\n', parts }) }));
});

// The spec as aw-build leaves it after building one slice: that slice ticked,
// with the test exception it recorded; the later slices still unticked;
// Traceability pointing at the test the slice added and at the verify
// evidence its exception relies on, neither of which needs to exist before
// implemented. This pins that aw-check-spec passes after each slice.
test('an approved spec with one slice ticked and a test exception, as aw-build leaves it, passes', () => {
  const parts = sections();
  parts['Slice plan'] =
    '1. [x] Sign-in form (AC-1, AC-2). AFK.\n' +
    '   - Delivers: a registered user reaches the dashboard; a wrong password shows an error.\n' +
    '   - Blocked by: none.\n' +
    '   - Test exception: AC-2. The error page renders only in a browser the suite cannot drive; ' +
    'proven by `verify:` evidence instead.\n' +
    '2. [ ] Lockout rule (AC-3). HITL.\n' +
    '   - Delivers: a locked account is refused and offered support.\n' +
    '   - Blocked by: 1.\n';
  parts.Traceability =
    '| Acceptance criterion | Evidence |\n| --- | --- |\n' +
    '| AC-1 | test: `tests/session.test.mjs` |\n' +
    '| AC-2 | verify: `docs/specs/login/verify/ac-2.md` |\n' +
    '| AC-3 | manual: support flow needs a staff account we cannot script |\n';

  assertNoFindings(runOn({ [SPEC]: specText({ frontmatter: 'status: approved\nticket: "#12"\n', parts }) }));
});

// The spec as aw-verify leaves it, once aw-ship has set it to implemented:
// each criterion's row keeps the test and manual entries it had and gains the
// result aw-verify recorded for it, a file under the spec's verify/ folder
// with its result in parentheses. An inconclusive result rests on the other
// evidence in its row. This pins that the check resolves every verify: path.
test('an implemented spec with the verify results aw-verify records passes', () => {
  const parts = sections();
  parts.Traceability =
    '| Acceptance criterion | Evidence |\n| --- | --- |\n' +
    '| AC-1 | test: `tests/login.test.mjs`; verify: `docs/specs/login/verify/ac-1.md` (passed) |\n' +
    '| AC-2 | verify: `docs/specs/login/verify/ac-2.md` (passed) |\n' +
    '| AC-3 | verify: `docs/specs/login/verify/ac-3.md` (inconclusive); ' +
    'manual: support flow needs a staff account we cannot script |\n';

  assertNoFindings(runOn({
    ...validRepo(specText({ parts })),
    'docs/specs/login/verify/ac-1.md': '# AC-1\n\nResult: passed\n',
    'docs/specs/login/verify/ac-3.md': '# AC-3\n\nResult: inconclusive\n',
  }));
});
