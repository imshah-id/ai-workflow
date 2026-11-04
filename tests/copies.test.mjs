// Seam 3: the copies this repo ships, read the way a harness reads them. The
// sync tests cover the transform on fixture upstreams; these pin what it
// produced on the real ones, at the pins in upstreams.json.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './fixtures.mjs';

const read = (path) => readFileSync(join(repoRoot, path), 'utf8');

// The upstream names of every copy, from upstreams.json.
const copiedNames = () =>
  Object.values(JSON.parse(read('upstreams.json')).upstreams).flatMap((upstream) => Object.keys(upstream.skills));

// Every file of a copy, relative to the repo root.
function filesOf(folder) {
  const files = [];
  const walk = (relative) => {
    for (const entry of readdirSync(join(repoRoot, relative), { withFileTypes: true })) {
      const path = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else files.push(path);
    }
  };
  walk(`skills/${folder}`);
  return files;
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The forms in which one skill refers to another (see README, "Copies and
// upstream sync"): in double quotes, as a slash command, backticked before
// "skill", and as the backticked text of a link.
const referencesTo = (name) =>
  new RegExp(
    [`"${name}"`, `(?:^|[\\s\`"'(\\[])/${name}(?![\\w/-]|\\.\\w)`, `\`${name}\` skill\\b`, `\\[\`${name}\`\\]\\(`]
      .map((form) => form.replaceAll(name, escape(name)))
      .join('|'),
    'm',
  );

test('copies call the Skill tool with the aw- names of other copies', () => {
  assert.match(read('skills/aw-tdd/SKILL.md'), /call the Skill tool with "aw-codebase-design"/);
  assert.match(read('skills/aw-grill-with-docs/SKILL.md'), /Call the Skill tool twice, for "aw-grilling" and "aw-domain-modeling"\./);
});

test('no copy refers to another copied skill by its unprefixed name', () => {
  const names = copiedNames();
  const found = [];
  for (const name of names) {
    for (const path of filesOf(`aw-${name}`)) {
      if (path.endsWith('/LICENSE.upstream')) continue;
      for (const other of names) {
        const match = read(path).match(referencesTo(other));
        if (match) found.push(`${path}: ${match[0].trim()}`);
      }
    }
  }
  assert.deepEqual(found, []);
});

// The invocation mode each copy has upstream at the pin. A user-invoked
// skill sets `disable-model-invocation: true` and an agents/openai.yaml
// policy with `allow_implicit_invocation: false`; a model-invoked one sets
// neither.
const USER_INVOKED = ['grill-with-docs', 'improve-codebase-architecture', 'handoff'];

test('each copy keeps its upstream invocation mode', () => {
  const modes = {};
  for (const name of copiedNames()) {
    const claude = /^disable-model-invocation: true$/m.test(read(`skills/aw-${name}/SKILL.md`));
    const codex = /^policy:\n\s+allow_implicit_invocation: false$/m.test(read(`skills/aw-${name}/agents/openai.yaml`));
    modes[name] = claude && codex ? 'user' : !claude && !codex ? 'model' : 'mixed';
  }
  const expected = Object.fromEntries(copiedNames().map((name) => [name, USER_INVOKED.includes(name) ? 'user' : 'model']));
  assert.deepEqual(modes, expected);
});

test('aw-diagnosing-bugs keeps its Bash template byte for byte (ADR 0008)', () => {
  const bytes = readFileSync(join(repoRoot, 'skills/aw-diagnosing-bugs/scripts/hitl-loop.template.sh'));
  const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  // The blob of skills/engineering/diagnosing-bugs/scripts/hitl-loop.template.sh
  // in mattpocock/skills at the pin d1478fc.
  assert.equal(blob, '243198464a8401a7ba1d63b3708fa43c3d067665');
});
