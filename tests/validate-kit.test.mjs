// Seam 2: the kit validation CLI, run from outside the way CI runs it.
// Each test builds a small fixture kit in a temp directory, runs
// `node scripts/validate-kit.mjs <dir>` and asserts on the exit code and the
// reported findings only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertNoFindings,
  assertOneFinding,
  manifests,
  repoRoot,
  runCli,
  validateCli,
  writeFiles,
} from './fixtures.mjs';

// A fixture kit maps each relative path to its content (see writeFiles). A
// valid kit has one model-invoked skill and one user-invoked skill.
function validKit() {
  return {
    ...manifests(['aw-alpha', 'aw-beta']),
    'skills/aw-alpha/SKILL.md':
      '---\nname: aw-alpha\ndescription: A model-invoked skill.\n---\n\nBody.\n',
    'skills/aw-beta/SKILL.md':
      '---\nname: aw-beta\ndescription: A user-invoked skill.\ndisable-model-invocation: true\n---\n\nBody.\n',
    'skills/aw-beta/agents/openai.yaml':
      'interface:\n  display_name: "Beta"\npolicy:\n  allow_implicit_invocation: false\n',
  };
}

function runOn(files, { git = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'aw-kit-'));
  try {
    if (git) spawnSync('git', ['init', '--quiet', dir], { encoding: 'utf8' });
    writeFiles(dir, files);
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const run = (dir) => runCli(validateCli, dir);

test('a valid kit passes with no findings', () => {
  assertNoFindings(runOn(validKit()));
});

test('a skill folder without the aw- prefix is reported', () => {
  const kit = validKit();
  kit['skills/alpha/SKILL.md'] = kit['skills/aw-alpha/SKILL.md'].replace('aw-alpha', 'alpha');
  delete kit['skills/aw-alpha/SKILL.md'];
  kit['.claude-plugin/plugin.json'].skills = ['./skills/alpha', './skills/aw-beta'];

  assertOneFinding(runOn(kit), /^skills\/alpha: .*aw-/);
});

test('a skill whose name: does not match its folder is reported', () => {
  const kit = validKit();
  kit['skills/aw-alpha/SKILL.md'] = kit['skills/aw-alpha/SKILL.md'].replace(
    'name: aw-alpha',
    'name: aw-other',
  );

  assertOneFinding(runOn(kit), /^skills\/aw-alpha\/SKILL\.md: .*aw-other.*aw-alpha/);
});

test('a quoted name: that matches its folder passes', () => {
  const kit = validKit();
  kit['skills/aw-alpha/SKILL.md'] = kit['skills/aw-alpha/SKILL.md'].replace(
    'name: aw-alpha',
    'name: "aw-alpha"',
  );

  assertNoFindings(runOn(kit));
});

test('a skill folder without SKILL.md is reported', () => {
  const kit = validKit();
  delete kit['skills/aw-alpha/SKILL.md'];
  kit['skills/aw-alpha/notes.md'] = 'Not a skill yet.\n';

  assertOneFinding(runOn(kit), /^skills\/aw-alpha: .*SKILL\.md/);
});

test('a skill missing from the plugin manifest is reported', () => {
  const kit = validKit();
  kit['.claude-plugin/plugin.json'].skills = ['./skills/aw-beta'];

  assertOneFinding(runOn(kit), /^skills\/aw-alpha: .*plugin\.json/);
});

test('a manifest entry with no skill folder behind it is reported', () => {
  const kit = validKit();
  kit['.claude-plugin/plugin.json'].skills.push('./skills/aw-ghost');

  assertOneFinding(runOn(kit), /^\.claude-plugin\/plugin\.json: .*aw-ghost/);
});

// A skill is user-invoked when it declares either flag. It must declare both:
// `disable-model-invocation: true` for Claude Code, `agents/openai.yaml` with
// `allow_implicit_invocation: false` for Codex.

test('a user-invoked skill without agents/openai.yaml is reported', () => {
  const kit = validKit();
  delete kit['skills/aw-beta/agents/openai.yaml'];

  assertOneFinding(runOn(kit), /^skills\/aw-beta\/agents\/openai\.yaml: .*missing/);
});

test('a user-invoked skill whose openai.yaml allows implicit invocation is reported', () => {
  const kit = validKit();
  kit['skills/aw-beta/agents/openai.yaml'] = 'interface:\n  display_name: "Beta"\n';

  assertOneFinding(runOn(kit), /^skills\/aw-beta\/agents\/openai\.yaml: .*allow_implicit_invocation: false/);
});

test('a skill whose openai.yaml disables implicit invocation but SKILL.md does not is reported', () => {
  const kit = validKit();
  kit['skills/aw-beta/SKILL.md'] = kit['skills/aw-beta/SKILL.md'].replace(
    'disable-model-invocation: true\n',
    '',
  );

  assertOneFinding(runOn(kit), /^skills\/aw-beta\/SKILL\.md: .*disable-model-invocation: true/);
});

test('a marketplace entry whose version differs from plugin.json is reported', () => {
  const kit = validKit();
  kit['.claude-plugin/marketplace.json'].plugins[0].version = '1.2.2';

  assertOneFinding(runOn(kit), /^\.claude-plugin\/marketplace\.json: .*1\.2\.2.*1\.2\.3/);
});

test('a plugin.json without a semver version is reported', () => {
  const kit = validKit();
  kit['.claude-plugin/plugin.json'].version = 'next';
  kit['.claude-plugin/marketplace.json'].plugins[0].version = 'next';

  assertOneFinding(runOn(kit), /^\.claude-plugin\/plugin\.json: .*version/);
});

test('a pre-release version is reported, since releases are plain X.Y.Z', () => {
  const kit = validKit();
  kit['.claude-plugin/plugin.json'].version = '1.2.3-beta.1';
  kit['.claude-plugin/marketplace.json'].plugins[0].version = '1.2.3-beta.1';

  assertOneFinding(runOn(kit), /^\.claude-plugin\/plugin\.json: .*version/);
});

test('a marketplace with no entry for the plugin is reported', () => {
  const kit = validKit();
  kit['.claude-plugin/marketplace.json'].plugins[0].name = 'someone-else';

  assertOneFinding(runOn(kit), /^\.claude-plugin\/marketplace\.json: .*fixture-kit/);
});

test('a text file with CRLF line endings is reported once', () => {
  const kit = validKit();
  kit['skills/aw-alpha/SKILL.md'] = kit['skills/aw-alpha/SKILL.md'].replace(/\n/g, '\r\n');

  assertOneFinding(runOn(kit), /^skills\/aw-alpha\/SKILL\.md: .*CRLF/);
});

test('in a git work tree, ignored files are not checked for line endings', () => {
  const kit = validKit();
  kit['.gitignore'] = 'local/\n';
  kit['local/notes.md'] = 'Written on Windows.\r\n';

  assertNoFindings(runOn(kit, { git: true }));
});

test('in a git work tree, untracked files that are not ignored are checked', () => {
  const kit = validKit();
  kit['notes.md'] = 'Written on Windows.\r\n';

  assertOneFinding(runOn(kit, { git: true }), /^notes\.md: .*CRLF/);
});

test('binary files are not checked for line endings', () => {
  const kit = validKit();
  kit['skills/aw-alpha/assets/icon.png'] = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

  assertNoFindings(runOn(kit));
});

test('a model-invoked skill may carry an openai.yaml without a policy', () => {
  const kit = validKit();
  kit['skills/aw-alpha/agents/openai.yaml'] = 'interface:\n  display_name: "Alpha"\n';

  assertNoFindings(runOn(kit));
});

test('a kit directory that does not exist is a usage error', () => {
  const { status, findings } = run(join(tmpdir(), 'aw-kit-does-not-exist'));
  assert.deepEqual(findings, []);
  assert.equal(status, 2);
});

test('this repo is a valid kit', () => {
  assertNoFindings(run(repoRoot));
});
