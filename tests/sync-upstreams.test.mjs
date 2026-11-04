// Seam 2: the upstream sync CLI and the kit validation CLI that runs its
// `check`, both run from outside the way a maintainer and CI run them.
// Each test builds a local-directory upstream (a git repo in a temp
// directory, so nothing touches the network) and a fixture kit whose
// upstreams.json points at it, installs the copies with
// `node scripts/sync-upstreams.mjs install <kit>`, and asserts on exit codes,
// reported findings and the installed files only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const syncCli = join(repoRoot, 'scripts', 'sync-upstreams.mjs');
const validateCli = join(repoRoot, 'scripts', 'validate-kit.mjs');

const json = (value) => JSON.stringify(value, null, 2) + '\n';

const temps = [];
process.on('exit', () => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

function writeFiles(dir, files) {
  for (const [path, content] of Object.entries(files)) {
    if (content === undefined) continue;
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    const isRaw = typeof content === 'string' || Buffer.isBuffer(content);
    writeFileSync(full, isRaw ? content : json(content));
  }
}

function git(dir, ...args) {
  const result = spawnSync(
    'git',
    ['-C', dir, '-c', 'user.name=fixture', '-c', 'user.email=fixture@example.com', '-c', 'core.autocrlf=false', ...args],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, `git ${args.join(' ')} failed:\n${result.stderr}`);
  return result.stdout.trim();
}

const UPSTREAM_LICENSE = 'MIT License\n\nCopyright (c) 2026 Upstream Author\n';

// An upstream skill collection, bucketed the way Pocock's repo is. `alpha`
// calls `beta` through the Skill tool and mentions "beta" in prose too.
function upstreamFiles() {
  return {
    LICENSE: UPSTREAM_LICENSE,
    'skills/group/alpha/SKILL.md':
      '---\nname: alpha\ndescription: An upstream skill.\n---\n\n' +
      'Call the Skill tool with "beta" first.\n' +
      'Then load `beta`, or run `/beta` yourself.\n' +
      'A beta release is not a skill reference, nor is `/beta/notes.md`.\n',
    'skills/group/alpha/agents/openai.yaml': 'interface:\n  display_name: "Alpha"\n',
    'skills/group/beta/SKILL.md': '---\nname: beta\ndescription: Another upstream skill.\n---\n\nBody.\n',
    'skills/group/gamma/SKILL.md': '---\nname: gamma\ndescription: Not copied.\n---\n\nBody.\n',
  };
}

// Creates the upstream as a git repo with one commit and returns its
// directory and that commit.
function makeUpstream(files = upstreamFiles()) {
  const dir = tempDir('aw-upstream-');
  git(dir, 'init', '--quiet');
  writeFiles(dir, files);
  git(dir, 'add', '--all');
  git(dir, 'commit', '--quiet', '-m', 'upstream');
  return { dir, commit: git(dir, 'rev-parse', 'HEAD') };
}

function notice(rows) {
  return (
    '# Notice\n\n| Skill | Upstream | Pin | Kind |\n| ----- | -------- | --- | ---- |\n' +
    rows.map((row) => `| ${row.join(' | ')} |\n`).join('')
  );
}

// A fixture kit that copies `alpha` and `beta` from the upstream.
function kitFiles(upstream) {
  const pin = upstream.commit.slice(0, 7);
  return {
    '.claude-plugin/plugin.json': {
      name: 'fixture-kit',
      version: '1.2.3',
      skills: ['./skills/aw-alpha', './skills/aw-beta'],
    },
    '.claude-plugin/marketplace.json': {
      name: 'fixture-kit',
      owner: { name: 'fixture' },
      plugins: [{ name: 'fixture-kit', source: './', version: '1.2.3' }],
    },
    'upstreams.json': {
      upstreams: {
        fixture: {
          repo: upstream.dir,
          commit: upstream.commit,
          license: 'LICENSE',
          skills: {
            alpha: 'skills/group/alpha',
            beta: 'skills/group/beta',
          },
        },
      },
    },
    'NOTICE.md': notice([
      ['`aw-alpha`', 'fixture', `\`${pin}\``, 'copy'],
      ['`aw-beta`', 'fixture', `\`${pin}\``, 'copy'],
    ]),
  };
}

function runCli(cli, ...args) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  const findings = result.stdout.split('\n').filter((line) => line.trim() !== '');
  return { status: result.status, findings, stdout: result.stdout, stderr: result.stderr };
}

const sync = (mode, dir, ...rest) => runCli(syncCli, mode, dir, ...rest);
const validate = (dir) => runCli(validateCli, dir);

// A fixture kit with its copies installed from a fresh upstream.
function installedKit({ upstream = makeUpstream(), edit } = {}) {
  const dir = tempDir('aw-kit-');
  const files = kitFiles(upstream);
  if (edit) edit(files, upstream);
  writeFiles(dir, files);
  const install = sync('install', dir);
  assert.equal(install.status, 0, `install failed:\n${install.stdout}${install.stderr}`);
  return { dir, upstream };
}

const read = (dir, path) => readFileSync(join(dir, path), 'utf8');
const write = (dir, path, content) => writeFileSync(join(dir, path), content);

function assertNoFindings({ status, findings, stderr }) {
  assert.deepEqual(findings, [], stderr);
  assert.equal(status, 0);
}

function assertOneFinding({ status, findings }, pattern) {
  assert.equal(findings.length, 1, `expected one finding, got:\n${findings.join('\n')}`);
  assert.match(findings[0], pattern);
  assert.notEqual(status, 0);
}

test('copies installed from a local-directory upstream pass the kit validator', () => {
  const { dir } = installedKit();

  assertNoFindings(validate(dir));
  assert.match(read(dir, 'skills/aw-alpha/SKILL.md'), /^---\nname: aw-alpha\n/);
});

test('install renames references to other copied skills and leaves prose alone', () => {
  const { dir } = installedKit();

  assert.equal(
    read(dir, 'skills/aw-alpha/SKILL.md'),
    '---\nname: aw-alpha\ndescription: An upstream skill.\n---\n\n' +
      'Call the Skill tool with "aw-beta" first.\n' +
      'Then load `aw-beta`, or run `/aw-beta` yourself.\n' +
      'A beta release is not a skill reference, nor is `/beta/notes.md`.\n',
  );
});

test('install keeps agents/ and adds the upstream license as LICENSE.upstream', () => {
  const { dir } = installedKit();

  assert.equal(read(dir, 'skills/aw-alpha/agents/openai.yaml'), 'interface:\n  display_name: "Alpha"\n');
  assert.equal(read(dir, 'skills/aw-alpha/LICENSE.upstream'), UPSTREAM_LICENSE);
});

test('a skill the manifest does not list is not copied', () => {
  const { dir } = installedKit();

  assert.throws(() => read(dir, 'skills/aw-gamma/SKILL.md'), /ENOENT/);
});

test('a copy edited by hand is reported', () => {
  const { dir } = installedKit();
  write(dir, 'skills/aw-beta/SKILL.md', read(dir, 'skills/aw-beta/SKILL.md').replace('Body.', 'Better body.'));

  assertOneFinding(validate(dir), /^skills\/aw-beta\/SKILL\.md: .*edited by hand/);
});

test('a copy missing a rename of another copied skill is reported', () => {
  const { dir } = installedKit();
  write(dir, 'skills/aw-alpha/SKILL.md', read(dir, 'skills/aw-alpha/SKILL.md').replace('"aw-beta"', '"beta"'));

  assertOneFinding(validate(dir), /^skills\/aw-alpha\/SKILL\.md: .*rename is missing/);
});

test('a copy whose name: was not renamed is reported', () => {
  const { dir } = installedKit();
  write(dir, 'skills/aw-beta/SKILL.md', read(dir, 'skills/aw-beta/SKILL.md').replace('name: aw-beta', 'name: beta'));

  const { status, findings } = validate(dir);
  assert.notEqual(status, 0);
  assert.ok(findings.some((finding) => /^skills\/aw-beta\/SKILL\.md: .*rename is missing/.test(finding)), findings.join('\n'));
});

test('a copy without LICENSE.upstream is reported', () => {
  const { dir } = installedKit();
  rmSync(join(dir, 'skills/aw-beta/LICENSE.upstream'));

  assertOneFinding(validate(dir), /^skills\/aw-beta\/LICENSE\.upstream: missing/);
});

test('a file added to a copy is reported', () => {
  const { dir } = installedKit();
  write(dir, 'skills/aw-beta/EXTRA.md', 'Not upstream.\n');

  assertOneFinding(validate(dir), /^skills\/aw-beta\/EXTRA\.md: not in the upstream skill/);
});

test('a copy without a NOTICE entry is reported', () => {
  const { dir } = installedKit({
    edit: (files, upstream) => {
      files['NOTICE.md'] = notice([['`aw-alpha`', 'fixture', `\`${upstream.commit.slice(0, 7)}\``, 'copy']]);
    },
  });

  assertOneFinding(validate(dir), /^NOTICE\.md: no entry for copy "aw-beta"/);
});

test('a NOTICE entry with a stale pin is reported', () => {
  const { dir } = installedKit({
    edit: (files, upstream) => {
      files['NOTICE.md'] = notice([
        ['`aw-alpha`', 'fixture', `\`${upstream.commit.slice(0, 7)}\``, 'copy'],
        ['`aw-beta`', 'fixture', '`0000000`', 'copy'],
      ]);
    },
  });

  assertOneFinding(validate(dir), /^NOTICE\.md: entry "aw-beta" must show its pin/);
});

test('a pin moved in upstreams.json without a fresh install is reported', () => {
  const upstream = makeUpstream();
  const { dir } = installedKit({ upstream });
  write(upstream.dir, 'skills/group/beta/SKILL.md', '---\nname: beta\ndescription: Changed.\n---\n\nBody.\n');
  git(upstream.dir, 'commit', '--quiet', '--all', '-m', 'change beta');
  const manifest = JSON.parse(read(dir, 'upstreams.json'));
  manifest.upstreams.fixture.commit = git(upstream.dir, 'rev-parse', 'HEAD');
  write(dir, 'upstreams.json', json(manifest));
  write(dir, 'NOTICE.md', read(dir, 'NOTICE.md').replaceAll(upstream.commit.slice(0, 7), manifest.upstreams.fixture.commit.slice(0, 7)));

  assertOneFinding(validate(dir), /^upstreams\.lock\.json: upstream "fixture" is locked at another pin/);
  assert.equal(sync('install', dir).status, 0);
  assertNoFindings(validate(dir));
  assert.match(read(dir, 'skills/aw-beta/SKILL.md'), /description: Changed\./);
});

test('sync check on its own reports the same findings and exits non-zero', () => {
  const { dir } = installedKit();
  assertNoFindings(sync('check', dir));

  write(dir, 'skills/aw-beta/SKILL.md', 'Rewritten.\n');
  assertOneFinding(sync('check', dir), /^skills\/aw-beta\/SKILL\.md: .*edited by hand/);
});

test('a kit with copies but no lock file is reported', () => {
  const { dir } = installedKit();
  rmSync(join(dir, 'upstreams.lock.json'));

  assertOneFinding(validate(dir), /^upstreams\.lock\.json: file is missing/);
});

test('report lists the upstream commits that changed a copied skill since the pin', () => {
  const upstream = makeUpstream();
  const { dir } = installedKit({ upstream });
  write(upstream.dir, 'skills/group/alpha/SKILL.md', 'Changed upstream.\n');
  git(upstream.dir, 'commit', '--quiet', '--all', '-m', 'rework alpha');

  const { status, stdout } = sync('report', dir);
  assert.equal(status, 0);
  assert.match(stdout, /fixture: .*1 commit\(s\) since the pin/);
  assert.match(stdout, /alpha \(skills\/group\/alpha\): changed\n\s+[0-9a-f]+ rework alpha/);
  assert.match(stdout, /beta \(skills\/group\/beta\): unchanged/);
});

test('an unknown mode is a usage error', () => {
  const { status } = runCli(syncCli, 'sync', repoRoot);
  assert.equal(status, 2);
});
