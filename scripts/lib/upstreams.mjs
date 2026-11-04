// Upstream sync: the manifest, the lock, the mechanical transform and the
// three modes of scripts/sync-upstreams.mjs (ADRs 0001, 0004, 0015).
// Maintainer-only, never ships to user repos. scripts/validate-kit.mjs
// imports `check`, `readUpstreams` and `readJsonFile` from here.
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
// A skill that points to shared files outside its folder is written as
// `{ "path": "<folder>", "shared": ["<file, by its path from the upstream's root>"] }`
// instead of the bare folder.
//
// `release` and `reason` record the choice of pin for people; no code reads
// them. Each copied skill lands in skills/aw-<upstream name>/.
//
// upstreams.lock.json records, for each copy, the git tree hash of its
// upstream folder at the pin and the mode and git blob hash of every file in
// it, plus the blob hash of the upstream license. A skill with shared files
// also records the mode and blob hash of each, under "shared". The tree hash is the one
// `git rev-parse <commit>:<folder>` prints, so the lock can be checked against
// the upstream, and `check` verifies that the file hashes add up to it.
//
// `check` needs only the lock and the copies, so it runs offline. It undoes
// the transform on each copied file, compares the result to the locked
// upstream hash, and redoes the transform to confirm the copy carries every
// rename and path rewrite it makes. It also reports any path in a copy that
// still climbs out of the copy's folder.

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
import { dirname, join, posix, resolve } from 'node:path';

export const PREFIX = 'aw-';
export const MANIFEST = 'upstreams.json';
export const LOCK = 'upstreams.lock.json';
export const LICENSE_FILE = 'LICENSE.upstream';

const INSTALL_HINT = 'run `node scripts/sync-upstreams.mjs install`';

export class SyncError extends Error {}

// ---------------------------------------------------------------------------
// Manifest and lock

// `{ value }` with the parsed JSON, `{ missing: true }` when the file does not
// exist, or `{ finding }` when it is not valid JSON.
export function readJsonFile(dir, path) {
  const full = join(dir, path);
  if (!existsSync(full)) return { missing: true };
  try {
    return { value: JSON.parse(readFileSync(full, 'utf8')) };
  } catch (error) {
    return { finding: `${path}: invalid JSON (${error.message})` };
  }
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// `a\b/` becomes `a/b`.
const toPosix = (path) => path.replace(/\\/g, '/').replace(/\/+$/, '');

// A file named by its path from a repo's root: relative, with no `.` or `..`
// segment and no empty one.
const isRepoFile = (path) => path !== '' && path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');

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
    for (const [name, value] of Object.entries(isObject(entry.skills) ? entry.skills : {})) {
      const { path, shared = [] } = isObject(value) ? value : { path: value };
      if (typeof path !== 'string' || path === '') {
        findings.push(`${at}: skill "${name}" needs the folder it lives in upstream`);
        continue;
      }
      const sharedPaths = Array.isArray(shared) ? shared.map((file) => (typeof file === 'string' ? toPosix(file) : '')) : null;
      if (sharedPaths === null || !sharedPaths.every(isRepoFile)) {
        findings.push(`${at}: skill "${name}" needs "shared" to list files by their path from the upstream's root`);
        continue;
      }
      const earlier = copies.find((copy) => copy.name === name);
      if (earlier) {
        findings.push(`${at}: skill "${name}" is already copied from upstream "${earlier.upstream.key}"`);
        continue;
      }
      const copy = { upstream, name, path: toPosix(path), folder: PREFIX + name, shared: [...new Set(sharedPaths)].sort() };
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
// A reference to a copied skill is its upstream name written in one of the
// forms upstream skills use to point at each other:
//
//   - in double quotes: call the Skill tool with "codebase-design";
//   - as a slash command: the `/codebase-design` skill;
//   - in backticks followed by "skill": the `codebase-design` skill;
//   - as the backticked text of a link: [`writing-for-agents`](SKILL.md).
//
// The copy's own SKILL.md also has its frontmatter `name:` renamed. Any other
// use of a name is left alone: prose ("a research question"), a bare
// backticked word (include the word `prototype` in the path) or a path
// (`/prototype/<name>`). `install` lists the quoted ones it left alone, so a
// reference in a form this list lacks does not slip through unseen.

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const alternation = (names) =>
  [...names]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|');

// Replaces every reference to a key of `pairs` with its value.
function swapReferences(text, pairs) {
  const froms = Object.keys(pairs);
  if (froms.length === 0) return text;
  const tokens = alternation(froms);
  const swap = (_match, token) => pairs[token];
  return text
    .replace(new RegExp(`(?<=")(${tokens})(?=")`, 'g'), swap)
    .replace(new RegExp(`(?<=\`)(${tokens})(?=\` skill\\b)`, 'g'), swap)
    .replace(new RegExp(`(?<=\\[\`)(${tokens})(?=\`\\]\\()`, 'g'), swap)
    .replace(new RegExp(`(?<![^\\s\`"'(\\[])/(${tokens})(?![\\w/-]|\\.\\w)`, 'g'), (_m, token) => `/${pairs[token]}`);
}

// Renames `from` to `to` in the `name:` field of SKILL.md's frontmatter.
function swapName(text, file, from, to) {
  if (file !== 'SKILL.md') return text;
  const match = text.match(/^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/);
  if (!match) return text;
  const head = match[0].replace(
    new RegExp(`^(name:[ \\t]*)(["']?)${escapeRegExp(from)}\\2([ \\t]*\\r?)$`, 'm'),
    (_m, key, quote, tail) => `${key}${quote}${to}${quote}${tail}`,
  );
  return head + text.slice(match[0].length);
}

// The rename for one copy, given the names of every copied skill: `apply`
// turns upstream text into copy text, `undo` turns it back.
function renamerFor(copy, names) {
  const toCopy = Object.fromEntries(names.map((name) => [name, PREFIX + name]));
  const toUpstream = Object.fromEntries(names.map((name) => [PREFIX + name, name]));
  const copyName = PREFIX + copy.name;
  return {
    apply: (text, file) => swapName(swapReferences(text, toCopy), file, copy.name, copyName),
    undo: (text, file) => swapName(swapReferences(text, toUpstream), file, copyName, copy.name),
  };
}

// ---------------------------------------------------------------------------
// The mechanical transform (ADR 0001), relocation part
//
// A shared upstream file is one outside the skill's folder that the skill
// points to, such as Addy Osmani's repo-level references/security-checklist.md.
// upstreams.json lists it under the skill's "shared", by its path from the
// upstream's root, and the copy holds it at that same path inside its folder:
// references/security-checklist.md lands in
// skills/aw-security-and-hardening/references/security-checklist.md.
//
// A path to a shared file is the relative path from the directory of the
// file that names it to the shared file, as upstream writes it (from a
// skill's SKILL.md, `../../references/security-checklist.md`). In the copy it
// becomes the relative path from the copy's file to the relocated one
// (`references/security-checklist.md`). Only that exact string is a path:
// it may be followed by an `#anchor` but not by more path, and the same
// words without the leading `../` are left alone.

// The path from the directory holding `from` to `to`, both repo-relative.
const relativePath = (from, to) => posix.relative(posix.dirname(`/${from}`), `/${to}`);

// Replaces each key of `pairs` with its value where it stands as a whole path.
function swapPaths(text, pairs) {
  const froms = Object.keys(pairs);
  if (froms.length === 0) return text;
  return text.replace(new RegExp(`(?<![\\w./-])(${alternation(froms)})(?![\\w/-]|\\.\\w)`, 'g'), (_m, path) => pairs[path]);
}

// The path rewrite for one file of a copy, given its path inside the copy.
// `toCopy` maps each path to a shared file as upstream writes it to the path
// the copy uses, `toUpstream` maps back.
function pathPairsFor(copy, file) {
  const upstreamFile = copy.shared.includes(file) ? file : `${copy.path}/${file}`;
  const toCopy = {};
  const toUpstream = {};
  for (const shared of copy.shared) {
    const from = relativePath(upstreamFile, shared);
    const to = relativePath(file, shared);
    if (from === to) continue;
    toCopy[from] = to;
    toUpstream[to] = from;
  }
  return { toCopy, toUpstream };
}

// The mechanical transform for one copy, given the names of every copied
// skill: `apply` turns upstream text into copy text and `undo` turns it back.
// `missingRewrite` tells whether copy text still holds a path to a shared
// file as upstream wrote it. `file` is the path inside the copy.
function transformFor(copy, names) {
  const renamer = renamerFor(copy, names);
  return {
    apply: (text, file) => renamer.apply(swapPaths(text, pathPairsFor(copy, file).toCopy), file),
    undo: (text, file) => swapPaths(renamer.undo(text, file), pathPairsFor(copy, file).toUpstream),
    missingRewrite: (text, file) => swapPaths(text, pathPairsFor(copy, file).toCopy) !== text,
  };
}

// Quoted or backticked uses of a copied name, and paths through a folder of
// that name, that the rename left in `text`, as `{ line, mention }`.
function leftAlone(text, names) {
  if (names.length === 0) return [];
  const tokens = alternation(names);
  const pattern = new RegExp(`\`(?:${tokens})\`|'(?:${tokens})'|(?<![\\w-])/(?:${tokens})/`, 'g');
  const mentions = [];
  text.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(pattern)) mentions.push({ line: index + 1, mention: match[0] });
  });
  return mentions;
}

// Text is UTF-8 without NUL bytes; anything else is copied byte for byte.
function asText(bytes) {
  if (bytes.includes(0)) return null;
  const text = bytes.toString('utf8');
  return Buffer.from(text, 'utf8').equals(bytes) ? text : null;
}

// ---------------------------------------------------------------------------
// Git object hashes, computed the way git computes them

const objectHash = (type, body) => createHash('sha1').update(`${type} ${body.length}\0`).update(body).digest('hex');

const blobHash = (bytes) => objectHash('blob', bytes);

// The tree hash of a folder from its files, given as
// `{ "<relative path>": { mode, blob } }`. Git sorts a tree's entries by name,
// comparing a subtree's name as if it ended in "/".
function treeHash(files) {
  const entries = [];
  const subtrees = {};
  for (const [path, entry] of Object.entries(files)) {
    const slash = path.indexOf('/');
    if (slash === -1) entries.push({ name: path, mode: entry.mode, hash: entry.blob });
    else (subtrees[path.slice(0, slash)] ??= {})[path.slice(slash + 1)] = entry;
  }
  for (const [name, subtree] of Object.entries(subtrees)) {
    entries.push({ name, mode: '40000', hash: treeHash(subtree) });
  }
  const sortKey = (entry) => Buffer.from(entry.mode === '40000' ? `${entry.name}/` : entry.name);
  entries.sort((a, b) => Buffer.compare(sortKey(a), sortKey(b)));
  const body = Buffer.concat(
    entries.flatMap((entry) => [Buffer.from(`${entry.mode} ${entry.name}\0`), Buffer.from(entry.hash, 'hex')]),
  );
  return objectHash('tree', body);
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

// A copied file passes when undoing the transform gives the locked upstream
// blob and redoing it gives the copy back. A copy checked out with CRLF line
// endings is compared with LF ones too (ADR 0008); the validator reports the
// CRLF on its own.
function checkFile(at, bytes, expectedBlob, file, transform) {
  const text = asText(bytes);
  if (text === null) {
    return blobHash(bytes) === expectedBlob ? [] : [`${at}: differs from upstream at the pin; a copy may change only by the mechanical transform`];
  }
  const candidates = text.includes('\r\n') ? [text, text.replace(/\r\n/g, '\n')] : [text];
  for (const candidate of candidates) {
    const upstream = transform.undo(candidate, file);
    if (blobHash(Buffer.from(upstream, 'utf8')) !== expectedBlob) continue;
    if (transform.apply(upstream, file) === candidate) return [];
    if (transform.missingRewrite(candidate, file)) {
      return [`${at}: a path rewrite is missing; the mechanical transform rewrites every path to a shared file to point inside the copy`];
    }
    return [`${at}: a rename is missing; the mechanical transform adds the aw- prefix to the name: field and to every reference to a copied skill`];
  }
  return [`${at}: differs from upstream plus the mechanical transform; a copy may not be edited by hand`];
}

// A relative path that climbs out of the copy's folder: one or more `../`
// then a file name with an extension, optionally followed by an `#anchor`.
// A bare `../`, as in code that tests for it, is not a path to a file. This
// is a heuristic: a path to a folder, or to a file without an extension, is
// not caught, so that example strings such as `../../etc/passwd` in a
// security skill are not taken for paths the copy depends on.
const CLIMBING_PATH = /(?<![\w./-])((?:\.\.\/)+(?:[\w.-]+\/)*[\w-][\w.-]*\.\w+)(#[\w-]*)?/g;

// One finding per path in a copied file that resolves outside the copy's
// folder (ADR 0002: a copy is installed one folder at a time).
function outsidePaths(at, bytes, file) {
  const text = asText(bytes);
  if (text === null) return [];
  const findings = [];
  text.split('\n').forEach((line, index) => {
    for (const [match, path] of line.matchAll(CLIMBING_PATH)) {
      if (!posix.normalize(posix.join(posix.dirname(file), path)).startsWith('../')) continue;
      findings.push(`${at}:${index + 1}: points outside the copy's folder: ${match}; list the file under "shared" in ${MANIFEST}`);
    }
  });
  return findings;
}

// True when a shared file would land on a file the copy already has: one of
// the skill's own files, given as an object keyed by path, or LICENSE.upstream.
const clashesWithSkill = (file, skillFiles) => file in skillFiles || file === LICENSE_FILE;

const isLockedFile = (entry) => isObject(entry) && typeof entry.mode === 'string' && typeof entry.blob === 'string';

// True when the lock holds exactly the shared files upstreams.json lists for
// the copy, none of them clashing with a file of the skill.
function locksShared(lockedSkill, copy) {
  const shared = lockedSkill.shared ?? {};
  if (!isObject(shared) || !Object.values(shared).every(isLockedFile)) return false;
  const files = Object.keys(shared).sort();
  return (
    files.length === copy.shared.length &&
    files.every((file, index) => file === copy.shared[index] && !clashesWithSkill(file, lockedSkill.files))
  );
}

function checkCopy(dir, copy, lockedSkill, licenseBlob, transform) {
  const at = `skills/${copy.folder}`;
  const copyDir = join(dir, at);
  if (!existsSync(copyDir) || !statSync(copyDir).isDirectory()) {
    return [`${at}: copy is missing; ${INSTALL_HINT}`];
  }
  const expected = { [LICENSE_FILE]: licenseBlob };
  for (const [file, entry] of Object.entries(lockedSkill.files)) expected[file] = entry.blob;
  for (const [file, entry] of Object.entries(lockedSkill.shared ?? {})) expected[file] = entry.blob;
  const actual = copyFiles(copyDir);
  const findings = [];
  for (const file of Object.keys(expected).sort()) {
    if (actual.includes(file)) continue;
    findings.push(
      file === LICENSE_FILE
        ? `${at}/${LICENSE_FILE}: missing; a copy carries its upstream license (ADR 0004)`
        : copy.shared.includes(file)
          ? `${at}/${file}: missing; the mechanical transform relocates the shared upstream file ${file} here`
          : `${at}/${file}: missing; the upstream skill has it at the pin`,
    );
  }
  for (const file of actual) {
    const path = `${at}/${file}`;
    if (!(file in expected)) {
      findings.push(`${path}: not in the upstream skill at the pin; a copy may not gain files`);
      continue;
    }
    const bytes = readFileSync(join(copyDir, file));
    const fileFindings = checkFile(path, bytes, expected[file], file, transform);
    findings.push(...(fileFindings.length > 0 ? fileFindings : outsidePaths(path, bytes, file)));
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
      const valid =
        isObject(lockedSkill) &&
        lockedSkill.path === copy.path &&
        isObject(lockedSkill.files) &&
        Object.values(lockedSkill.files).every(isLockedFile) &&
        locksShared(lockedSkill, copy);
      if (!valid) {
        findings.push(`${at}: skill "${copy.name}" is not locked as ${MANIFEST} lists it; ${INSTALL_HINT}`);
        continue;
      }
      if (treeHash(lockedSkill.files) !== lockedSkill.tree) {
        findings.push(`${at}: skill "${copy.name}" has file hashes that do not match its tree hash; ${INSTALL_HINT}`);
        continue;
      }
      findings.push(...checkCopy(dir, copy, lockedSkill, lockedUpstream.license.blob, transformFor(copy, names)));
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

// git's stdout, or null when it exits non-zero.
function tryGit(gitDir, args, { encoding = 'utf8' } = {}) {
  const result = spawnSync('git', ['-C', gitDir, ...args], { encoding, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw new SyncError(`git could not be run: ${result.error.message}`);
  return result.status === 0 ? result.stdout : null;
}

// git's stdout; throws when it exits non-zero.
function git(gitDir, args, options) {
  const out = tryGit(gitDir, args, options);
  if (out === null) throw new SyncError(`git ${args.join(' ')} failed in ${gitDir}`);
  return out;
}

// The git object hash at `commit:path`, or null when there is none.
function objectAt(gitDir, commit, path) {
  return tryGit(gitDir, ['rev-parse', '--verify', '--quiet', `${commit}:${path}`])?.trim() ?? null;
}

// Runs `fn` with a git directory holding the upstream, after checking the
// pinned commit is there: the repo itself when `repo` is a local directory,
// otherwise a fresh clone in a temp directory, removed afterwards.
function withUpstream(dir, upstream, fn) {
  const local = resolve(dir, upstream.repo);
  let gitDir = local;
  let temp = null;
  if (!existsSync(local) || !statSync(local).isDirectory()) {
    temp = mkdtempSync(join(tmpdir(), 'aw-sync-'));
    const clone = spawnSync('git', ['clone', '--quiet', '--no-checkout', upstream.repo, temp], { encoding: 'utf8' });
    if (clone.status !== 0) {
      rmSync(temp, { recursive: true, force: true });
      throw new SyncError(`could not clone ${upstream.repo}:\n${(clone.stderr ?? clone.error?.message ?? '').trim()}`);
    }
    gitDir = temp;
  }
  try {
    if (tryGit(gitDir, ['cat-file', '-e', `${upstream.commit}^{commit}`]) === null) {
      throw new SyncError(`upstream "${upstream.key}" has no commit ${upstream.commit}`);
    }
    return fn(gitDir);
  } finally {
    if (temp) rmSync(temp, { recursive: true, force: true });
  }
}

// The regular files `git ls-tree` lists at `commit` for `pathspec`, as
// { path, mode, blob } with `path` from the repo's root. Throws on anything
// else, such as a symlink or a submodule: copies hold only regular files.
function regularFiles(gitDir, commit, pathspec, { recursive }) {
  return git(gitDir, ['ls-tree', ...(recursive ? ['-r'] : []), '-z', '--full-tree', commit, '--', pathspec])
    .split('\0')
    .filter(Boolean)
    .map((line) => {
      const [meta, path] = line.split('\t');
      const [mode, type, blob] = meta.split(' ');
      if (type !== 'blob' || (mode !== '100644' && mode !== '100755')) {
        throw new SyncError(`${path} at ${commit} is not a regular file (mode ${mode}); copies hold only regular files`);
      }
      return { path, mode, blob };
    });
}

// Every file under `path` at `commit`, as { file, mode, blob } with `file`
// relative to `path`.
function treeFiles(gitDir, commit, path) {
  return regularFiles(gitDir, commit, `${path}/`, { recursive: true }).map(({ path: fullPath, mode, blob }) => ({
    file: fullPath.slice(path.length + 1),
    mode,
    blob,
  }));
}

// The mode and blob of the regular file at `commit:path`.
function fileAt(gitDir, commit, path) {
  const [entry] = regularFiles(gitDir, commit, path, { recursive: false });
  if (entry?.path !== path) throw new SyncError(`there is no file ${path} at ${commit}`);
  return { mode: entry.mode, blob: entry.blob };
}

const readBlob = (gitDir, blob) => git(gitDir, ['cat-file', 'blob', blob], { encoding: 'buffer' });

// ---------------------------------------------------------------------------
// install

function writeFile(path, bytes) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}

// Writes one upstream file into a copy with the mechanical transform
// applied, and returns the lines listing what the rename left alone in it.
// Throws when the transform cannot be undone on the file, since `check`
// could then never verify the copy.
function installFile(copyDir, at, file, bytes, transform, names) {
  const text = asText(bytes);
  if (text === null) {
    writeFile(join(copyDir, file), bytes);
    return [];
  }
  const copied = transform.apply(text, file);
  if (transform.undo(copied, file) !== text) {
    throw new SyncError(`${at}/${file}: the mechanical transform cannot be undone on this file, so check could not verify it`);
  }
  writeFile(join(copyDir, file), copied);
  return leftAlone(copied, names).map(({ line, mention }) => `${at}/${file}:${line}: left alone: ${mention}`);
}

// Installs every copy at its pin, applies the mechanical transform, adds
// LICENSE.upstream and rewrites the lock. Copies dropped from the manifest
// since the last install are removed, so the copies always match the
// manifest. Returns the lines to print.
export function install(dir) {
  const { upstreams, copies, findings } = readUpstreams(dir);
  if (findings.length > 0) throw new SyncError(findings.join('\n'));
  const names = copies.map((copy) => copy.name);
  const previous = readJsonFile(dir, LOCK).value;
  const lock = { upstreams: {} };
  const lines = [];

  for (const upstream of upstreams) {
    withUpstream(dir, upstream, (gitDir) => {
      const licenseBlob = objectAt(gitDir, upstream.commit, upstream.license);
      if (licenseBlob === null) {
        throw new SyncError(`upstream "${upstream.key}" has no ${upstream.license} at ${upstream.commit}`);
      }
      const license = readBlob(gitDir, licenseBlob);
      const lockedSkills = {};
      for (const copy of upstream.skills) {
        const tree = objectAt(gitDir, upstream.commit, copy.path);
        if (tree === null) {
          throw new SyncError(`upstream "${upstream.key}" has no ${copy.path} at ${upstream.commit}`);
        }
        const at = `skills/${copy.folder}`;
        const copyDir = join(dir, at);
        const transform = transformFor(copy, names);
        rmSync(copyDir, { recursive: true, force: true });
        const files = {};
        for (const { file, mode, blob } of treeFiles(gitDir, upstream.commit, copy.path)) {
          files[file] = { mode, blob };
          lines.push(...installFile(copyDir, at, file, readBlob(gitDir, blob), transform, names));
        }
        const shared = {};
        for (const file of copy.shared) {
          if (clashesWithSkill(file, files)) {
            throw new SyncError(`${at}/${file}: shared file ${file} would replace a file the skill already has`);
          }
          shared[file] = fileAt(gitDir, upstream.commit, file);
          lines.push(...installFile(copyDir, at, file, readBlob(gitDir, shared[file].blob), transform, names));
        }
        lines.push(...installFile(copyDir, at, LICENSE_FILE, license, transform, names));
        lockedSkills[copy.name] = { path: copy.path, tree, files, ...(copy.shared.length > 0 && { shared }) };
        lines.push(`installed ${at} from ${upstream.key} ${copy.path} at ${upstream.commit.slice(0, 12)}`);
      }
      lock.upstreams[upstream.key] = {
        repo: upstream.repo,
        commit: upstream.commit,
        license: { path: upstream.license, blob: licenseBlob },
        skills: lockedSkills,
      };
    });
  }

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
    withUpstream(dir, upstream, (gitDir) => {
      const head = git(gitDir, ['rev-parse', 'HEAD']).trim();
      const count = git(gitDir, ['rev-list', '--count', `${upstream.commit}..${head}`]).trim();
      lines.push(`${upstream.key}: pinned at ${upstream.commit.slice(0, 12)}, upstream is at ${head.slice(0, 12)}, ${count} commit(s) since the pin`);
      const paths = [
        ...upstream.skills.flatMap((copy) => [
          { label: `${copy.name} (${copy.path})`, path: copy.path },
          ...copy.shared.map((file) => ({ label: `${copy.name} shared file (${file})`, path: file })),
        ]),
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
          lines.push(`  ${label}: changed`);
          const log = git(gitDir, ['log', '--format=%h %s', `${upstream.commit}..${head}`, '--', path]).trim();
          for (const entry of log.split('\n').filter(Boolean)) lines.push(`    ${entry}`);
        }
      }
    });
  }
  return lines;
}
