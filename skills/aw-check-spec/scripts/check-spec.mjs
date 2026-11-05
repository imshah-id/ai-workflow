// Spec check CLI, shipped inside the aw-check-spec skill (ADR 0012).
//
// Usage: node <skill-folder>/scripts/check-spec.mjs [repo-root]
//
// Validates every spec at docs/specs/<slug>/spec.md under repo-root (default:
// the current directory) and prints one finding per line as
// `<path>: <message>`. Exits 0 when every spec is valid or there are no
// specs, 1 when there are findings, 2 on a usage error.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SPECS_DIR = 'docs/specs';

const repoRoot = resolve(process.argv[2] ?? '.');
if (!existsSync(repoRoot) || !statSync(repoRoot).isDirectory()) {
  console.error(`usage: node check-spec.mjs [repo-root]\nnot a directory: ${repoRoot}`);
  process.exit(2);
}

// The entries directly under docs/specs/: slug folders, and Markdown files
// written where a slug folder belongs.
function specsEntries(dir) {
  const specsDir = join(dir, SPECS_DIR);
  if (!existsSync(specsDir)) return { slugs: [], loose: [] };
  const entries = readdirSync(specsDir, { withFileTypes: true });
  const names = (keep) => entries.filter(keep).map((entry) => entry.name).sort();
  return {
    slugs: names((entry) => entry.isDirectory()),
    loose: names((entry) => entry.isFile() && /\.md$/i.test(entry.name) && !/^readme\.md$/i.test(entry.name)),
  };
}

const isFile = (path) => existsSync(path) && statSync(path).isFile();

function unquote(value) {
  const match = value.match(/^(["'])(.*)\1$/);
  return match ? match[2] : value;
}

// The spec's lines, LF or CRLF, without a byte-order mark.
function specLines(text) {
  return text.replace(/^\uFEFF/, '').split(/\r?\n/);
}

// Top-level `key: value` pairs of the frontmatter block and the index of the
// first body line, or null when the spec has no frontmatter.
function parseFrontmatter(lines) {
  if (lines[0]?.trim() !== '---') return null;
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (end === -1) return null;
  const fields = {};
  for (const line of lines.slice(1, end)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
    if (match) fields[match[1]] = unquote(match[2]);
  }
  return { fields, bodyStart: end + 1 };
}

function checkSpec(dir, slug) {
  const at = `${SPECS_DIR}/${slug}/spec.md`;
  const full = join(dir, at);
  if (!isFile(full)) return [`${SPECS_DIR}/${slug}: spec folder has no spec.md file`];
  const lines = specLines(readFileSync(full, 'utf8'));
  const frontmatter = parseFrontmatter(lines);
  if (frontmatter === null) {
    return [`${at}: missing frontmatter; the spec must start with a "---" block holding "status:"`];
  }
  const sections = parseSections(lines.slice(frontmatter.bodyStart));
  const criteria = definedCriteria(sections.get('acceptance criteria') ?? []);
  const rows = traceabilityRows(sections.get('traceability') ?? []);
  return [
    ...checkFrontmatter(dir, frontmatter.fields),
    ...checkSections(sections),
    ...checkTraceability(criteria, rows, sections.has('traceability')),
    ...checkOpenQuestions(frontmatter.fields.status, sections.get('open questions') ?? []),
    ...(frontmatter.fields.status === 'implemented' ? checkEvidence(dir, rows) : []),
  ].map((message) => `${at}: ${message}`);
}

// One evidence entry per part of a cell, as { kind, value } with backticks
// dropped from the value. Entries are separated by `;` or `<br>` followed by
// the next kind, so a manual reason may itself hold a `;`. A part with no
// known kind keeps its whole text as the value and a null kind.
function evidenceEntries(cell) {
  return cell
    .split(/(?:;|<br\s*\/?>)\s*(?=(?:test|verify|manual):)/i)
    .map((part) => part.trim().replace(/(?:;|<br\s*\/?>)$/i, '').trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(test|verify|manual):\s*(.*)$/);
      return match
        ? { kind: match[1], value: match[2].replace(/`/g, '').trim() }
        : { kind: null, value: part };
    });
}

// A `test:` or `verify:` path relative to the repo root, either separator.
const repoPath = (dir, path) => join(dir, ...path.split(/[\\/]+/));

// The verify result aw-verify records after a verify path, as in
// `verify: <path> (passed)`. It is not part of the path.
const VERIFY_RESULT_SUFFIX = /\s+\((?:passed|failed|inconclusive)\)$/;

// How each kind of evidence resolves: a finding message, or null when the
// entry resolves.
const RESOLVES = {
  test(dir, id, path) {
    if (!path || !isFile(repoPath(dir, path))) return `test file "${path}" does not exist`;
    const mentions = new RegExp(`\\b${id}(?!\\d)`);
    return mentions.test(readFileSync(repoPath(dir, path), 'utf8'))
      ? null
      : `test file "${path}" does not mention ${id}`;
  },
  verify(dir, id, value) {
    const path = value.replace(VERIFY_RESULT_SUFFIX, '');
    return path && existsSync(repoPath(dir, path)) ? null : `verify path "${path}" does not exist`;
  },
  manual(dir, id, reason) {
    return reason ? null : 'manual evidence needs a reason, as "manual: <what was checked and why no test>"';
  },
};

function checkEvidence(dir, rows) {
  const findings = [];
  for (const [id, cells] of rows) {
    const entries = cells.flatMap(evidenceEntries);
    if (entries.length === 0) findings.push(`${id}: no evidence in Traceability; an implemented spec needs some`);
    for (const { kind, value } of entries) {
      const problem = kind === null
        ? `evidence "${value}" must start with test:, verify: or manual:`
        : RESOLVES[kind](dir, id, value);
      if (problem) findings.push(`${id}: ${problem}`);
    }
  }
  return findings;
}

// Statuses from which no blocking question may stay open. A superseded spec
// is left out: it may have been superseded while still a draft.
const SETTLED = ['approved', 'implemented'];

// A list item in Open questions that starts with `BLOCKS:` (bold or not) is
// an open blocking question.
function checkOpenQuestions(status, lines) {
  if (!SETTLED.includes(status)) return [];
  const findings = [];
  for (const line of lines) {
    const item = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*?)\s*$/)?.[1];
    if (item && /^[*_]*BLOCKS:/.test(item)) {
      findings.push(`open blocking question in a spec at "${status}": ${item}`);
    }
  }
  return findings;
}

// `AC-12` but not the `AC-1` inside it.
const AC = /AC-\d+(?!\d)/;

// The AC-n ids defined in Acceptance criteria, in order, repeats included. A
// criterion is defined by a list item or heading that starts with its id,
// such as `- **AC-1**: Given …` or `### AC-1`.
function definedCriteria(lines) {
  const ids = [];
  for (const line of lines) {
    const item = line.match(/^\s*(?:[-*+]|\d+[.)]|#{3,6})\s+(?:\[[ xX]\]\s+)?(.*)$/);
    const id = item?.[1].replace(/^[*_`]+/, '').match(new RegExp(`^${AC.source}`))?.[0];
    if (id) ids.push(id);
  }
  return ids;
}

// Traceability table rows as a map from AC-n to its evidence cells, one entry
// per row. The header and separator rows have no AC-n in their first cell.
function traceabilityRows(lines) {
  const rows = new Map();
  for (const line of lines) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
    const id = cells[0].match(AC)?.[0];
    if (!id) continue;
    if (!rows.has(id)) rows.set(id, []);
    rows.get(id).push(cells[1] ?? '');
  }
  return rows;
}

function checkTraceability(criteria, rows, hasSection) {
  const findings = [];
  const seen = new Set();
  if (criteria.length === 0) {
    findings.push('Acceptance criteria defines no AC-n; write each as "- **AC-1**: Given …, when …, then …"');
  }
  for (const id of criteria) {
    if (seen.has(id)) findings.push(`${id} is defined more than once in Acceptance criteria`);
    seen.add(id);
  }
  if (!hasSection) return findings; // already reported as a missing section
  for (const id of seen) {
    if (!rows.has(id)) findings.push(`${id} has no row in the Traceability table`);
  }
  for (const id of rows.keys()) {
    if (!seen.has(id)) findings.push(`Traceability has a row for ${id}, which Acceptance criteria does not define`);
  }
  return findings;
}

// The body's `## ` sections, keyed by lowercased heading, each holding its
// lines up to the next `## ` or `# ` heading. Lines inside fenced code blocks
// are dropped, so an example in a code block is never read as structure.
function parseSections(lines) {
  const sections = new Map();
  let current = null;
  let fence = null;
  for (const line of lines) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      continue;
    }
    if (marker) {
      fence = marker[1];
      continue;
    }
    const heading = line.match(/^(#{1,2})\s+(.*?)\s*#*\s*$/);
    if (heading) {
      current = heading[1] === '##' ? heading[2].toLowerCase() : null;
      if (current !== null && !sections.has(current)) sections.set(current, []);
      continue;
    }
    if (current !== null) sections.get(current).push(line);
  }
  return sections;
}

const SECTIONS = [
  'Problem and goal',
  'Acceptance criteria',
  'Out of scope',
  'Boundaries',
  'Design',
  'Slice plan',
  'Test strategy',
  'Traceability',
  'Open questions',
];
const BOUNDARY_TIERS = ['Always', 'Ask first', 'Never'];

function checkSections(sections) {
  const findings = [];
  for (const title of SECTIONS) {
    if (!sections.has(title.toLowerCase())) findings.push(`missing section "${title}" (a "## ${title}" heading)`);
  }
  const boundaries = sections.get('boundaries');
  if (boundaries) {
    const tiers = new Set(
      boundaries
        .map((line) => line.match(/^###\s+(.*?)\s*#*\s*$/)?.[1].toLowerCase())
        .filter(Boolean),
    );
    for (const tier of BOUNDARY_TIERS) {
      if (!tiers.has(tier.toLowerCase())) findings.push(`Boundaries has no "${tier}" tier (a "### ${tier}" heading)`);
    }
  }
  return findings;
}

const STATUSES = ['draft', 'approved', 'implemented', 'superseded'];
const FIELDS = ['status', 'ticket', 'superseded-by'];

function checkFrontmatter(dir, fields) {
  const findings = [];
  const { status } = fields;
  if (status === undefined) {
    findings.push(`frontmatter has no "status"; use one of ${STATUSES.join(', ')}`);
  } else if (!STATUSES.includes(status)) {
    findings.push(`status "${status}" is not one of ${STATUSES.join(', ')}`);
  }
  const replacement = fields['superseded-by'];
  if (status === 'superseded' && !replacement) {
    findings.push('a superseded spec needs "superseded-by: <slug>" naming the spec that replaces it');
  } else if (status === 'superseded' && !existsSync(join(dir, SPECS_DIR, replacement, 'spec.md'))) {
    findings.push(`superseded-by "${replacement}" names no spec at ${SPECS_DIR}/${replacement}/spec.md`);
  } else if (status !== 'superseded' && replacement !== undefined) {
    findings.push(`"superseded-by" is only allowed when status is superseded, not "${status ?? ''}"`);
  }
  for (const key of Object.keys(fields)) {
    if (!FIELDS.includes(key)) {
      findings.push(`frontmatter field "${key}" is not allowed; use only ${FIELDS.join(', ')}`);
    }
  }
  return findings;
}

const { slugs, loose } = specsEntries(repoRoot);
if (slugs.length === 0 && loose.length === 0) {
  console.error(`no specs found under ${SPECS_DIR}/ in ${repoRoot}; nothing to check`);
  process.exit(0);
}
const findings = [
  ...loose.map((name) => `${SPECS_DIR}/${name}: a spec lives at ${SPECS_DIR}/<slug>/spec.md; move it into a slug folder`),
  ...slugs.flatMap((slug) => checkSpec(repoRoot, slug)),
];

for (const finding of findings) console.log(finding);
if (findings.length > 0) {
  console.error(`${findings.length} finding(s) in ${slugs.length} spec(s) under ${SPECS_DIR}/`);
  process.exit(1);
}
console.error(`${slugs.length} spec(s) valid under ${SPECS_DIR}/`);
