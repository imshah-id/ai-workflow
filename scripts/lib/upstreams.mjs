// Upstream sync: the manifest, the lock, the mechanical transform and the
// three modes of scripts/sync-upstreams.mjs (ADRs 0001, 0004, 0015).
// Maintainer-only, never ships to user repos. scripts/validate-kit.mjs
// imports `check` and `readUpstreams` from here.
//
// upstreams.json pins each upstream and lists the skills copied from it:
//
//   { "upstreams": { "<key>": {
//       "repo": "<git URL, or a local directory holding a git repo>",
//       "commit": "<full commit SHA>",
//       "release": "<upstream tag at that commit, if any>",
//       "reason": "<why this pin was chosen>",
//       "license": "<the upstream license file, LICENSE by default>",
//       "skills": { "<upstream name>": "<folder in the upstream repo>" } } } }
//
// Each copied skill lands in skills/aw-<upstream name>/. upstreams.lock.json
// records, for each copy, the git tree hash of its upstream folder at the pin
// and the git blob hash of every file in it, plus the blob hash of the
// upstream license. `check` needs only the lock and the copies, so it runs
// offline: it undoes the rename on each copied file, compares the result to
// the locked upstream hash, and redoes the rename to confirm the copy carries
// every rename the transform makes.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export const PREFIX = 'aw-';
export const MANIFEST = 'upstreams.json';
export const LOCK = 'upstreams.lock.json';
export const LICENSE_FILE = 'LICENSE.upstream';

const INSTALL_HINT = 'run `node scripts/sync-upstreams.mjs install`';

// ---------------------------------------------------------------------------
// Manifest and lock

function readJsonFile(dir, path) {
  const full = join(dir, path);
  if (!existsSync(full)) return { missing: true };
  try {
    return { value: JSON.parse(readFileSync(full, 'utf8')) };
  } catch (error) {
    return { finding: `${path}: invalid JSON (${error.message})` };
  }
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// The copies upstreams.json declares, flattened, with any findings about the
// manifest's shape. A kit without upstreams.json has no copies.
export function readUpstreams(dir) {
  const read = readJsonFile(dir, MANIFEST);
  if (read.missing) return { upstreams: [], copies: [], findings: [] };
  if (read.finding) return { upstreams: [], copies: [], findings: [read.finding] };

  const findings = [];
  const upstreams = [];
  const copies = [];
  const entries = isObject(read.value.upstreams) ? Object.entries(read.value.upstreams) : [];
  if (!isObject(read.value.upstreams)) findings.push(`${MANIFEST}: "upstreams" must be an object`);

  for (const [key, entry] of entries) {
    const at = `${MANIFEST}: upstream "${key}"`;
    if (!isObject(entry)) {
      findings.push(`${at} must be an object`);
      continue;
    }
    if (typeof entry.repo !== 'string' || entry.repo === '') findings.push(`${at} needs a "repo"`);
    if (typeof entry.commit !== 'string' || !/^[0-9a-f]{40}$/.test(entry.commit)) {
      findings.push(`${at} needs a "commit" that is a full 40-character SHA`);
    }
    if (!isObject(entry.skills)) findings.push(`${at} needs "skills", an object of name to folder`);
    const upstream = {
      key,
      repo: entry.repo,
      commit: entry.commit,
      license: typeof entry.license === 'string' ? entry.license : 'LICENSE',
      skills: [],
    };
    for (const [name, path] of Object.entries(isObject(entry.skills) ? entry.skills : {})) {
      if (typeof path !== 'string' || path === '') {
        findings.push(`${at}: skill "${name}" needs the folder it lives in upstream`);
        continue;
      }
      const copy = { upstream, name, path: path.replace(/\\/g, '/').replace(/\/+$/, ''), folder: PREFIX + name };
      if (copies.some((other) => other.name === name)) {
        findings.push(`${at}: skill "${name}" is already copied from upstream "${copies.find((o) => o.name === name).upstream.key}"`);
        continue;
      }
      upstream.skills.push(copy);
      copies.push(copy);
    }
    upstreams.push(upstream);
  }
  return { upstreams, copies, findings };
}

// ---------------------------------------------------------------------------
// The mechanical transform (ADR 0001), rename part
//
// A reference to a copied skill is its upstream name written as a whole
// token in one of the forms upstream skills use to point at each other:
// in double quotes (`call the Skill tool with "tdd"`), in backticks
// (`` `writing-for-agents` ``) or as a slash command (`/codebase-design`).
// The copy's own SKILL.md also has its frontmatter `name:` renamed. Prose
// that happens to use a skill's name ("a research question") is left alone.

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Replaces each token `from` with `pairs[from]` in the reference forms.
function swapReferences(text, pairs) {
  const froms = Object.keys(pairs).sort((a, b) => b.length - a.length);
  if (froms.length === 0) return text;
  const tokens = froms.map(escapeRegExp).join('|');
  const swap = (_match, token) => pairs[token];
  return text
    .replace(new RegExp(`(?<=")(${tokens})(?=")`, 'g'), swap)
    .replace(new RegExp(`(?<=\`)(${tokens})(?=\`)`, 'g'), swap)
    .replace(new RegExp(`(?<![^\\s\`"'(\\[])/(${tokens})(?![\\w/-]|\\.\\w)`, 'g'), (_m, token) => `/${pairs[token]}`);
}

// Renames `from` to `to` in the `name:` field of a leading frontmatter block.
function swapName(text, from, to) {
  const match = text.match(/^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/);
  if (!match) return text;
  const head = match[0].replace(
    new RegExp(`^(name:[ \\t]*)(["']?)${escapeRegExp(from)}\\2([ \\t]*\\r?)$`, 'm'),
    (_m, key, quote, tail) => `${key}${quote}${to}${quote}${tail}`,
  );
  return head + text.slice(match[0].length);
}

// `direction` is 'apply' (upstream to copy) or 'undo' (copy to upstream).
function rename(text, { file, own, names, direction }) {
  const pairs = {};
  for (const name of names) {
    if (direction === 'apply') pairs[name] = PREFIX + name;
    else pairs[PREFIX + name] = name;
  }
  let result = swapReferences(text, pairs);
  if (file === 'SKILL.md') {
    result = direction === 'apply' ? swapName(result, own, PREFIX + own) : swapName(result, PREFIX + own, own);
  }
  return result;
}

// Text is UTF-8 without NUL bytes; anything else is copied byte for byte.
function asText(bytes) {
  if (bytes.includes(0)) return null;
  const text = bytes.toString('utf8');
  return Buffer.from(text, 'utf8').equals(bytes) ? text : null;
}

function transform(bytes, context) {
  const text = asText(bytes);
  return text === null ? bytes : Buffer.from(rename(text, { ...context, direction: 'apply' }), 'utf8');
}

// The git blob hash of some bytes, the same one `git hash-object` prints.
function blobHash(bytes) {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

// ---------------------------------------------------------------------------
// check

function copyFiles(dir) {
  const files = [];
  const walk = (relative) => {
    for (const entry of readdirSync(join(dir, relative), { withFileTypes: true })) {
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path);
      else files.push(path);
    }
  };
  walk('');
  return files.sort();
}

function checkFile(at, bytes, expectedHash, context) {
  const text = asText(bytes);
  if (text === null) {
    return blobHash(bytes) === expectedHash ? [] : [`${at}: differs from upstream at the pin; a copy may change only by the mechanical transform`];
  }
  const upstream = rename(text, { ...context, direction: 'undo' });
  if (blobHash(Buffer.from(upstream, 'utf8')) !== expectedHash) {
    return [`${at}: differs from upstream plus the mechanical transform; a copy may not be edited by hand`];
  }
  if (rename(upstream, { ...context, direction: 'apply' }) !== text) {
    return [`${at}: a rename is missing; the mechanical transform adds the aw- prefix to the name: field and to every reference to a copied skill`];
  }
  return [];
}

function checkCopy(dir, copy, lockedSkill, licenseHash, names) {
  const at = `skills/${copy.folder}`;
  const copyDir = join(dir, at);
  if (!existsSync(copyDir) || !statSync(copyDir).isDirectory()) {
    return [`${at}: copy is missing; ${INSTALL_HINT}`];
  }
  const expected = { ...lockedSkill.files, [LICENSE_FILE]: licenseHash };
  const actual = copyFiles(copyDir);
  const findings = [];
  for (const file of Object.keys(expected).sort()) {
    if (actual.includes(file)) continue;
    findings.push(
      file === LICENSE_FILE
        ? `${at}/${LICENSE_FILE}: missing; a copy carries its upstream license (ADR 0004)`
        : `${at}/${file}: missing; the upstream skill has it at the pin`,
    );
  }
  for (const file of actual) {
    const path = `${at}/${file}`;
    if (!(file in expected)) {
      findings.push(`${path}: not in the upstream skill at the pin; a copy may not gain files`);
      continue;
    }
    findings.push(...checkFile(path, readFileSync(join(copyDir, file)), expected[file], { file, own: copy.name, names }));
  }
  return findings;
}

// Verifies offline that each copy equals its upstream at the pin plus the
// mechanical transform. Returns one finding string per problem.
export function check(dir) {
  const { upstreams, copies, findings } = readUpstreams(dir);
  if (findings.length > 0 || copies.length === 0) return findings;

  const read = readJsonFile(dir, LOCK);
  if (read.missing) return [`${LOCK}: file is missing; ${INSTALL_HINT}`];
  if (read.finding) return [read.finding];
  const locked = isObject(read.value.upstreams) ? read.value.upstreams : {};
  const names = copies.map((copy) => copy.name);

  for (const upstream of upstreams) {
    const lockedUpstream = locked[upstream.key];
    const at = `${LOCK}: upstream "${upstream.key}"`;
    if (!isObject(lockedUpstream)) {
      findings.push(`${at} is not locked; ${INSTALL_HINT}`);
      continue;
    }
    if (lockedUpstream.commit !== upstream.commit || lockedUpstream.license?.path !== upstream.license) {
      findings.push(`${at} is locked at another pin than ${MANIFEST} names; ${INSTALL_HINT}`);
      continue;
    }
    const lockedSkills = isObject(lockedUpstream.skills) ? lockedUpstream.skills : {};
    for (const copy of upstream.skills) {
      const lockedSkill = lockedSkills[copy.name];
      if (!isObject(lockedSkill) || lockedSkill.path !== copy.path || !isObject(lockedSkill.files)) {
        findings.push(`${at}: skill "${copy.name}" is not locked as ${MANIFEST} lists it; ${INSTALL_HINT}`);
        continue;
      }
      findings.push(...checkCopy(dir, copy, lockedSkill, lockedUpstream.license.blob, names));
    }
    for (const name of Object.keys(lockedSkills)) {
      if (!upstream.skills.some((copy) => copy.name === name)) {
        findings.push(`${at}: skill "${name}" is locked but not listed in ${MANIFEST}; ${INSTALL_HINT}`);
      }
    }
  }
  for (const key of Object.keys(locked)) {
    if (!upstreams.some((upstream) => upstream.key === key)) {
      findings.push(`${LOCK}: upstream "${key}" is locked but not listed in ${MANIFEST}; ${INSTALL_HINT}`);
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Reading an upstream through git (install and report)

class SyncError extends Error {}

function git(gitDir, args, { encoding = 'utf8' } = {}) {
  const result = spawnSync('git', ['-C', gitDir, ...args], { encoding, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw new SyncError(`git could not be run: ${result.error.message}`);
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : result.stderr;
    throw new SyncError(`git ${args.join(' ')} failed in ${gitDir}:\n${stderr.trim()}`);
  }
  return result.stdout;
}

// A git directory holding the upstream: the repo itself when `repo` is a
// local directory, otherwise a fresh clone in a temp directory.
function openUpstream(dir, upstream) {
  const local = resolve(dir, upstream.repo);
  if (existsSync(local) && statSync(local).isDirectory()) return { gitDir: local, cleanup: () => {} };
  const temp = mkdtempSync(join(tmpdir(), 'aw-sync-'));
  const cleanup = () => rmSync(temp, { recursive: true, force: true });
  const clone = spawnSync('git', ['clone', '--quiet', '--no-checkout', upstream.repo, temp], { encoding: 'utf8' });
  if (clone.status !== 0) {
    cleanup();
    throw new SyncError(`could not clone ${upstream.repo}:\n${(clone.stderr ?? clone.error?.message ?? '').trim()}`);
  }
  return { gitDir: temp, cleanup };
}

function hasCommit(gitDir, commit) {
  return spawnSync('git', ['-C', gitDir, 'cat-file', '-e', `${commit}^{commit}`]).status === 0;
}

// The git object hash at `commit:path`, or null when there is none.
function objectAt(gitDir, commit, path) {
  const result = spawnSync('git', ['-C', gitDir, 'rev-parse', '--verify', '--quiet', `${commit}:${path}`], {
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

// Every file under `path` at `commit`, as { file, hash } with `file`
// relative to `path`.
function treeFiles(gitDir, commit, path) {
  const out = git(gitDir, ['ls-tree', '-r', '-z', '--full-tree', commit, '--', `${path}/`]);
  return out
    .split('\0')
    .filter(Boolean)
    .map((line) => {
      const [meta, fullPath] = line.split('\t');
      const [mode, type, hash] = meta.split(' ');
      if (type !== 'blob' || mode === '120000') {
        throw new SyncError(`${fullPath} at ${commit} is a ${mode === '120000' ? 'symlink' : type}; copies hold only regular files`);
      }
      return { file: fullPath.slice(path.length + 1), hash };
    });
}

const blob = (gitDir, hash) => git(gitDir, ['cat-file', 'blob', hash], { encoding: 'buffer' });

// ---------------------------------------------------------------------------
// install

function writeFile(path, bytes) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}

// Installs every copy at its pin, applies the mechanical transform, adds
// LICENSE.upstream and rewrites the lock. Returns the lines to print.
export function install(dir) {
  const { upstreams, copies, findings } = readUpstreams(dir);
  if (findings.length > 0) throw new SyncError(findings.join('\n'));
  const names = copies.map((copy) => copy.name);
  const previous = readJsonFile(dir, LOCK).value;
  const lock = { upstreams: {} };
  const lines = [];

  for (const upstream of upstreams) {
    const { gitDir, cleanup } = openUpstream(dir, upstream);
    try {
      if (!hasCommit(gitDir, upstream.commit)) {
        throw new SyncError(`upstream "${upstream.key}" has no commit ${upstream.commit}`);
      }
      const licenseHash = objectAt(gitDir, upstream.commit, upstream.license);
      if (licenseHash === null) {
        throw new SyncError(`upstream "${upstream.key}" has no ${upstream.license} at ${upstream.commit}`);
      }
      const license = blob(gitDir, licenseHash);
      const lockedSkills = {};
      for (const copy of upstream.skills) {
        const tree = objectAt(gitDir, upstream.commit, copy.path);
        if (tree === null) {
          throw new SyncError(`upstream "${upstream.key}" has no ${copy.path} at ${upstream.commit}`);
        }
        const copyDir = join(dir, 'skills', copy.folder);
        rmSync(copyDir, { recursive: true, force: true });
        const files = {};
        for (const { file, hash } of treeFiles(gitDir, upstream.commit, copy.path)) {
          files[file] = hash;
          writeFile(join(copyDir, file), transform(blob(gitDir, hash), { file, own: copy.name, names }));
        }
        writeFile(join(copyDir, LICENSE_FILE), transform(license, { file: LICENSE_FILE, own: copy.name, names }));
        lockedSkills[copy.name] = { path: copy.path, tree, files };
        lines.push(`installed skills/${copy.folder} from ${upstream.key} ${copy.path} at ${upstream.commit.slice(0, 12)}`);
      }
      lock.upstreams[upstream.key] = {
        repo: upstream.repo,
        commit: upstream.commit,
        license: { path: upstream.license, blob: licenseHash },
        skills: lockedSkills,
      };
    } finally {
      cleanup();
    }
  }

  // Copies dropped from the manifest since the last install are removed.
  for (const lockedUpstream of Object.values(isObject(previous?.upstreams) ? previous.upstreams : {})) {
    for (const name of Object.keys(isObject(lockedUpstream?.skills) ? lockedUpstream.skills : {})) {
      if (names.includes(name)) continue;
      rmSync(join(dir, 'skills', PREFIX + name), { recursive: true, force: true });
      lines.push(`removed skills/${PREFIX + name}, no longer listed in ${MANIFEST}`);
    }
  }

  writeFileSync(join(dir, LOCK), JSON.stringify(lock, null, 2) + '\n');
  lines.push(`wrote ${LOCK}`);
  return lines;
}

// ---------------------------------------------------------------------------
// report

// Lists, for each upstream, what changed on its default branch since the
// pin: per copied skill and for the license. Returns the lines to print.
export function report(dir) {
  const { upstreams, findings } = readUpstreams(dir);
  if (findings.length > 0) throw new SyncError(findings.join('\n'));
  const lines = [];
  for (const upstream of upstreams) {
    const { gitDir, cleanup } = openUpstream(dir, upstream);
    try {
      if (!hasCommit(gitDir, upstream.commit)) {
        throw new SyncError(`upstream "${upstream.key}" has no commit ${upstream.commit}`);
      }
      const head = git(gitDir, ['rev-parse', 'HEAD']).trim();
      const count = git(gitDir, ['rev-list', '--count', `${upstream.commit}..${head}`]).trim();
      lines.push(`${upstream.key}: pinned at ${upstream.commit.slice(0, 12)}, upstream is at ${head.slice(0, 12)}, ${count} commit(s) since the pin`);
      const paths = [
        ...upstream.skills.map((copy) => ({ label: `${copy.name} (${copy.path})`, path: copy.path })),
        { label: `license (${upstream.license})`, path: upstream.license },
      ];
      for (const { label, path } of paths) {
        const before = objectAt(gitDir, upstream.commit, path);
        const after = objectAt(gitDir, head, path);
        if (after === null) {
          lines.push(`  ${label}: removed upstream`);
        } else if (before === after) {
          lines.push(`  ${label}: unchanged`);
        } else {
          const log = git(gitDir, ['log', '--format=%h %s', `${upstream.commit}..${head}`, '--', path]).trim();
          lines.push(`  ${label}: changed`);
          for (const entry of log.split('\n').filter(Boolean)) lines.push(`    ${entry}`);
        }
      }
    } finally {
      cleanup();
    }
  }
  return lines;
}

export { SyncError };
