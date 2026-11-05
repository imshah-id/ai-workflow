// Seam 2: the upstream sync CLI and the kit validation CLI that runs its
// `check`, both run from outside the way a maintainer and CI run them.
// Each test builds a local-directory upstream (a git repo in a temp
// directory, so nothing touches the network) and a fixture kit whose
// upstreams.json points at it, installs the copies with
// `node scripts/sync-upstreams.mjs install <kit>`, and asserts on exit codes,
// reported findings and output. The rename and relocation tests also read the
// installed copy, since the copy is what `install` outputs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertNoFindings,
  assertOneFinding,
  json,
  manifests,
  repoRoot,
  runCli,
  syncCli,
  validateCli,
  writeFiles,
} from './fixtures.mjs';

const temps = [];
process.on('exit', () => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
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
// refers to `beta` in every form the rename knows, and also uses the name
// where it is not a reference.
const ALPHA =
  '---\nname: alpha\ndescription: An upstream skill.\n---\n\n' +
  'Call the Skill tool with "beta" first.\n' +
  'Then load the `beta` skill, or run `/beta` yourself.\n' +
  'The rest of [`alpha`](SKILL.md) applies.\n' +
  'Put `beta` in the filename; a beta release is not a reference, nor is `/beta/notes.md`.\n';

function upstreamFiles() {
  return {
    LICENSE: UPSTREAM_LICENSE,
    'skills/group/alpha/SKILL.md': ALPHA,
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

// The NOTICE.md row of a copy of `name` from `upstream`.
const noticeRow = (name, upstream, pin = upstream.commit.slice(0, 7)) => [`\`${name}\``, `[fixture](${upstream.dir})`, `\`${pin}\``, 'copy'];

// A fixture kit that copies `alpha` and `beta` from the upstream.
function kitFiles(upstream) {
  return {
    ...manifests(['aw-alpha', 'aw-beta']),
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
    'NOTICE.md': notice([noticeRow('aw-alpha', upstream), noticeRow('aw-beta', upstream)]),
  };
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
  return { dir, upstream, install };
}

const read = (dir, path) => readFileSync(join(dir, path), 'utf8');
const write = (dir, path, content) => writeFileSync(join(dir, path), content);

test('copies installed from a local-directory upstream pass the kit validator', () => {
  const { dir } = installedKit();

  assertNoFindings(validate(dir));
  assert.match(read(dir, 'skills/aw-alpha/SKILL.md'), /^---\nname: aw-alpha\n/);
});

test('install renames references to other copied skills and leaves other uses of the name alone', () => {
  const { dir } = installedKit();

  assert.equal(
    read(dir, 'skills/aw-alpha/SKILL.md'),
    '---\nname: aw-alpha\ndescription: An upstream skill.\n---\n\n' +
      'Call the Skill tool with "aw-beta" first.\n' +
      'Then load the `aw-beta` skill, or run `/aw-beta` yourself.\n' +
      'The rest of [`aw-alpha`](SKILL.md) applies.\n' +
      'Put `beta` in the filename; a beta release is not a reference, nor is `/beta/notes.md`.\n',
  );
});

// A kit that also copies `gamma`, which calls two other copies in one
// sentence, the way grill-with-docs calls grilling and domain-modeling.
function kitWithCaller() {
  const files = upstreamFiles();
  files['skills/group/gamma/SKILL.md'] =
    '---\nname: gamma\ndescription: Calls two copies.\n---\n\nCall the Skill tool twice, for "alpha" and "beta".\n';
  return installedKit({
    upstream: makeUpstream(files),
    edit: (kit, upstream) => {
      Object.assign(kit, manifests(['aw-alpha', 'aw-beta', 'aw-gamma']));
      kit['upstreams.json'].upstreams.fixture.skills.gamma = 'skills/group/gamma';
      kit['NOTICE.md'] = notice(['aw-alpha', 'aw-beta', 'aw-gamma'].map((name) => noticeRow(name, upstream)));
    },
  });
}

test('install renames every copied skill one sentence calls', () => {
  const { dir } = kitWithCaller();

  assert.equal(
    read(dir, 'skills/aw-gamma/SKILL.md'),
    '---\nname: aw-gamma\ndescription: Calls two copies.\n---\n\nCall the Skill tool twice, for "aw-alpha" and "aw-beta".\n',
  );
  assertNoFindings(validate(dir));
});

test('a copy missing one of the renames in a sentence is reported', () => {
  const { dir } = kitWithCaller();
  write(dir, 'skills/aw-gamma/SKILL.md', read(dir, 'skills/aw-gamma/SKILL.md').replace('"aw-beta"', '"beta"'));

  assertOneFinding(validate(dir), /^skills\/aw-gamma\/SKILL\.md: .*rename is missing/);
});

test('install lists the quoted uses of a copied name it left alone, for the maintainer to judge', () => {
  const { install } = installedKit();

  const leftAlone = install.stdout.split('\n').filter((line) => line.includes('left alone'));
  assert.deepEqual(leftAlone, [
    'skills/aw-alpha/SKILL.md:9: left alone: `beta`',
    'skills/aw-alpha/SKILL.md:9: left alone: /beta/',
  ]);
});

test('a copy checked out with CRLF line endings is reported once, for its line endings', () => {
  const { dir } = installedKit();
  write(dir, 'skills/aw-alpha/SKILL.md', read(dir, 'skills/aw-alpha/SKILL.md').replace(/\n/g, '\r\n'));

  assertNoFindings(sync('check', dir));
  assertOneFinding(validate(dir), /^skills\/aw-alpha\/SKILL\.md: .*CRLF/);
});

test('a lock whose file hashes no longer match its tree hash is reported', () => {
  const { dir } = installedKit();
  write(dir, 'skills/aw-beta/SKILL.md', read(dir, 'skills/aw-beta/SKILL.md').replace('Body.', 'Edited.'));
  const lock = JSON.parse(read(dir, 'upstreams.lock.json'));
  const edited = read(dir, 'skills/aw-beta/SKILL.md').replace('name: aw-beta', 'name: beta');
  const blob = spawnSync('git', ['hash-object', '--stdin'], { input: edited, encoding: 'utf8' }).stdout.trim();
  lock.upstreams.fixture.skills.beta.files['SKILL.md'].blob = blob;
  write(dir, 'upstreams.lock.json', json(lock));

  assertOneFinding(validate(dir), /^upstreams\.lock\.json: .*"beta".*tree hash/);
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
      files['NOTICE.md'] = notice([noticeRow('aw-alpha', upstream)]);
    },
  });

  assertOneFinding(validate(dir), /^NOTICE\.md: no entry for copy "aw-beta"/);
});

test('a NOTICE entry with a stale pin is reported', () => {
  const { dir } = installedKit({
    edit: (files, upstream) => {
      files['NOTICE.md'] = notice([noticeRow('aw-alpha', upstream), noticeRow('aw-beta', upstream, '0000000')]);
    },
  });

  assertOneFinding(validate(dir), /^NOTICE\.md: entry "aw-beta" must show its pin/);
});

test('a NOTICE entry that names another upstream is reported', () => {
  const { dir } = installedKit({
    edit: (files, upstream) => {
      const beta = noticeRow('aw-beta', upstream);
      beta[1] = '[someone/else](https://example.com/someone/else)';
      files['NOTICE.md'] = notice([noticeRow('aw-alpha', upstream), beta]);
    },
  });

  assertOneFinding(validate(dir), /^NOTICE\.md: entry "aw-beta" must link its upstream/);
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

// An upstream whose `delta` skill points, from its SKILL.md and from a file
// in its own references/ folder, to a checklist at the upstream's root, the
// way Addy Osmani's security-and-hardening points to references/security-checklist.md.
// It also names a skill the kit does not copy, which is prose, not a path.
const DELTA =
  '---\nname: delta\ndescription: Points outside its folder.\n---\n\n' +
  'Details: [patterns](references/patterns.md). Walk `../../../references/checklist.md` before sign-off.\n' +
  'Ops agrees (the `observability` skill says so).\n';
const DELTA_PATTERNS = 'Shared lists live in `../../../../references/checklist.md#lists`.\n';
const CHECKLIST = 'Use alongside the `delta` skill. Not a path: `rel === \'../\'`.\n';

function upstreamWithShared(extraFiles = {}) {
  return makeUpstream({
    ...upstreamFiles(),
    'references/checklist.md': CHECKLIST,
    'skills/group/delta/SKILL.md': DELTA,
    'skills/group/delta/references/patterns.md': DELTA_PATTERNS,
    ...extraFiles,
  });
}

// A fixture kit that also copies `delta`, relocating the shared checklist.
function kitWithShared({ shared = ['references/checklist.md'], upstream = upstreamWithShared() } = {}) {
  return installedKit({
    upstream,
    edit: (kit) => {
      Object.assign(kit, manifests(['aw-alpha', 'aw-beta', 'aw-delta']));
      kit['upstreams.json'].upstreams.fixture.skills.delta = { path: 'skills/group/delta', shared };
      kit['NOTICE.md'] = notice(['aw-alpha', 'aw-beta', 'aw-delta'].map((name) => noticeRow(name, upstream)));
    },
  });
}

test('install moves a shared upstream file into the copy and rewrites the paths to it', () => {
  const { dir } = kitWithShared();

  assert.equal(
    read(dir, 'skills/aw-delta/SKILL.md'),
    '---\nname: aw-delta\ndescription: Points outside its folder.\n---\n\n' +
      'Details: [patterns](references/patterns.md). Walk `references/checklist.md` before sign-off.\n' +
      'Ops agrees (the `observability` skill says so).\n',
  );
  assert.equal(read(dir, 'skills/aw-delta/references/patterns.md'), 'Shared lists live in `checklist.md#lists`.\n');
  assert.equal(
    read(dir, 'skills/aw-delta/references/checklist.md'),
    'Use alongside the `aw-delta` skill. Not a path: `rel === \'../\'`.\n',
  );
  assertNoFindings(validate(dir));
});

test('a copy missing a relocated shared file is reported', () => {
  const { dir } = kitWithShared();
  rmSync(join(dir, 'skills/aw-delta/references/checklist.md'));

  assertOneFinding(validate(dir), /^skills\/aw-delta\/references\/checklist\.md: missing; .*relocates the shared upstream file/);
});

test('a copy whose path to a shared file was not rewritten is reported', () => {
  const { dir } = kitWithShared();
  write(
    dir,
    'skills/aw-delta/references/patterns.md',
    read(dir, 'skills/aw-delta/references/patterns.md').replace('`checklist.md', '`../../../../references/checklist.md'),
  );

  assertOneFinding(sync('check', dir), /^skills\/aw-delta\/references\/patterns\.md: a path rewrite is missing/);
});

test('a copy pointing to an upstream file it does not relocate is reported', () => {
  const { dir } = kitWithShared({ shared: [] });

  const { status, findings } = validate(dir);
  assert.notEqual(status, 0);
  assert.deepEqual(findings, [
    'skills/aw-delta/SKILL.md:6: points outside the copy\'s folder: ../../../references/checklist.md; list the file under "shared" in upstreams.json',
    'skills/aw-delta/references/patterns.md:1: points outside the copy\'s folder: ../../../../references/checklist.md#lists; list the file under "shared" in upstreams.json',
  ]);
});

// A kit whose `delta` copy also has references/notes.md with the given text.
function kitWithDeltaNotes(notes) {
  return kitWithShared({ upstream: upstreamWithShared({ 'skills/group/delta/references/notes.md': notes }) });
}

test('a copy pointing to a folder outside its folder is reported', () => {
  const { dir } = kitWithDeltaNotes('Helpers live in `../../../shared/`.\n');

  assertOneFinding(
    validate(dir),
    /^skills\/aw-delta\/references\/notes\.md:1: points outside the copy's folder: \.\.\/\.\.\/\.\.\/shared\/; list the files the copy needs from it under "shared" in upstreams\.json$/,
  );
});

test('a copy pointing to a file without an extension outside its folder is reported', () => {
  const { dir } = kitWithDeltaNotes('Build with `../../../Makefile`.\n');

  assertOneFinding(
    validate(dir),
    /^skills\/aw-delta\/references\/notes\.md:1: points outside the copy's folder: \.\.\/\.\.\/\.\.\/Makefile; list the file under "shared" in upstreams\.json$/,
  );
});

test('a copy whose paths climb but stay inside its folder is not reported', () => {
  const { dir } = kitWithDeltaNotes(
    'Back to [the skill](../SKILL.md) and `../references/patterns.md#lists`; the folder is `../references/`.\n',
  );

  assertNoFindings(validate(dir));
});

test('a copy with a bare ../ or a ../ inside a longer path or word is not reported', () => {
  const { dir } = kitWithDeltaNotes("Not paths: `rel === '../'`, `rel === '..'`, `../..`, a../b and `x/../../y`.\n");

  assertNoFindings(validate(dir));
});

test('report lists the upstream commits that changed a shared file a copy relocates', () => {
  const upstream = upstreamWithShared();
  const { dir } = kitWithShared({ upstream });
  write(upstream.dir, 'references/checklist.md', 'Changed upstream.\n');
  git(upstream.dir, 'commit', '--quiet', '--all', '-m', 'rework checklist');

  const { status, stdout } = sync('report', dir);
  assert.equal(status, 0);
  assert.match(stdout, /delta \(skills\/group\/delta\): unchanged/);
  assert.match(stdout, /delta shared file \(references\/checklist\.md\): changed\n\s+[0-9a-f]+ rework checklist/);
});

test('an unknown mode is a usage error', () => {
  const { status } = runCli(syncCli, 'sync', repoRoot);
  assert.equal(status, 2);
});
