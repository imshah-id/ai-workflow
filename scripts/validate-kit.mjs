// Kit validation CLI (maintainer-only, never ships to user repos).
//
// Usage: node scripts/validate-kit.mjs [kit-dir]
//
// Checks the kit invariants and prints one finding per line as
// `<path>: <message>`. Exits 0 when the kit is valid, 1 when there are
// findings, 2 on a usage error.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { check as checkCopies, MANIFEST as UPSTREAMS_MANIFEST, readUpstreams } from './lib/upstreams.mjs';

const PREFIX = 'aw-';

const kitDir = resolve(process.argv[2] ?? '.');
if (!existsSync(kitDir) || !statSync(kitDir).isDirectory()) {
  console.error(`usage: node scripts/validate-kit.mjs [kit-dir]\nnot a directory: ${kitDir}`);
  process.exit(2);
}

function skillFolders(dir) {
  const skillsDir = join(dir, 'skills');
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function unquote(value) {
  const match = value.match(/^(["'])(.*)\1$/);
  return match ? match[2] : value;
}

// Top-level `key: value` pairs of a SKILL.md frontmatter block, or null when
// the file has none. Nested and multi-line values are not needed here.
function frontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end === -1) return null;
  const fields = {};
  for (const line of lines.slice(1, end)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
    if (match) fields[match[1]] = unquote(match[2]);
  }
  return fields;
}

function checkSkills(dir) {
  const findings = [];
  for (const folder of skillFolders(dir)) {
    const at = `skills/${folder}`;
    if (!folder.startsWith(PREFIX)) {
      findings.push(`${at}: skill folder must carry the "${PREFIX}" prefix`);
    }
    const skillFile = join(dir, at, 'SKILL.md');
    if (!existsSync(skillFile)) {
      findings.push(`${at}: skill folder has no SKILL.md`);
      continue;
    }
    const fields = frontmatter(readFileSync(skillFile, 'utf8'));
    if (fields === null) {
      findings.push(`${at}/SKILL.md: missing frontmatter`);
      continue;
    }
    if (fields.name !== folder) {
      findings.push(
        `${at}/SKILL.md: name "${fields.name ?? ''}" does not match folder "${folder}"`,
      );
    }
    findings.push(...checkInvocation(dir, at, fields));
  }
  return findings;
}

// True when an agents/openai.yaml sets `allow_implicit_invocation: false`
// under its top-level `policy:` block.
function disablesImplicitInvocation(yaml) {
  let inPolicy = false;
  for (const line of yaml.split(/\r?\n/)) {
    if (/^\S/.test(line)) inPolicy = /^policy:\s*(#.*)?$/.test(line);
    else if (inPolicy && /^\s+allow_implicit_invocation:\s*false\s*(#.*)?$/.test(line)) return true;
  }
  return false;
}

// A skill is user-invoked when it declares either flag, and then it must
// declare both: Claude Code reads SKILL.md, Codex reads agents/openai.yaml.
function checkInvocation(dir, at, fields) {
  const yamlPath = `${at}/agents/openai.yaml`;
  const yamlFile = join(dir, yamlPath);
  const yaml = existsSync(yamlFile) ? readFileSync(yamlFile, 'utf8') : null;
  const claudeUserInvoked = fields['disable-model-invocation'] === 'true';
  const codexUserInvoked = yaml !== null && disablesImplicitInvocation(yaml);

  if (claudeUserInvoked && yaml === null) {
    return [`${yamlPath}: missing; a user-invoked skill needs one with "policy: allow_implicit_invocation: false"`];
  }
  if (claudeUserInvoked && !codexUserInvoked) {
    return [`${yamlPath}: a user-invoked skill must set "policy: allow_implicit_invocation: false"`];
  }
  if (codexUserInvoked && !claudeUserInvoked) {
    return [`${at}/SKILL.md: openai.yaml disables implicit invocation, so the frontmatter must set "disable-model-invocation: true"`];
  }
  return [];
}

const PLUGIN_MANIFEST = '.claude-plugin/plugin.json';
const MARKETPLACE_MANIFEST = '.claude-plugin/marketplace.json';

// Parsed JSON, or a finding string when the file is missing or invalid.
function readJson(dir, path) {
  const full = join(dir, path);
  if (!existsSync(full)) return { finding: `${path}: file is missing` };
  try {
    return { value: JSON.parse(readFileSync(full, 'utf8')) };
  } catch (error) {
    return { finding: `${path}: invalid JSON (${error.message})` };
  }
}

// `./skills/aw-x/` and `skills\aw-x` both become `skills/aw-x`.
function normalizeSkillPath(entry) {
  return entry.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

function checkManifestListing(dir, plugin) {
  const findings = [];
  const entries = Array.isArray(plugin.skills) ? plugin.skills : [];
  if (!Array.isArray(plugin.skills)) {
    findings.push(`${PLUGIN_MANIFEST}: "skills" must be an array of skill folders`);
  }
  const listed = new Set();
  for (const entry of entries) {
    const path = typeof entry === 'string' ? normalizeSkillPath(entry) : '';
    if (!/^skills\/[^/]+$/.test(path)) {
      findings.push(`${PLUGIN_MANIFEST}: skills entry ${JSON.stringify(entry)} must be "./skills/<name>"`);
    } else if (!existsSync(join(dir, path))) {
      findings.push(`${PLUGIN_MANIFEST}: skills entry "${entry}" has no skill folder`);
    }
    listed.add(path);
  }
  for (const folder of skillFolders(dir)) {
    if (!listed.has(`skills/${folder}`)) {
      findings.push(`skills/${folder}: skill is not listed in ${PLUGIN_MANIFEST}`);
    }
  }
  return findings;
}

// Releases are plain semver tags vX.Y.Z (ADR 0015).
const SEMVER = /^\d+\.\d+\.\d+$/;

// plugin.json holds the version a release bumps; the marketplace entry for
// the plugin must carry the same one.
function checkVersions(plugin, marketplace) {
  const findings = [];
  if (typeof plugin.version !== 'string' || !SEMVER.test(plugin.version)) {
    findings.push(`${PLUGIN_MANIFEST}: "version" must be plain semver X.Y.Z, such as "0.1.0"`);
  }
  const plugins = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];
  const entry = plugins.find((candidate) => candidate?.name === plugin.name);
  if (!entry) {
    findings.push(`${MARKETPLACE_MANIFEST}: no plugins entry named "${plugin.name}"`);
  } else if (entry.version !== plugin.version) {
    findings.push(
      `${MARKETPLACE_MANIFEST}: entry "${plugin.name}" has version "${entry.version ?? ''}" but ${PLUGIN_MANIFEST} has "${plugin.version ?? ''}"`,
    );
  }
  return findings;
}

// Files to check for line endings, relative and `/`-separated. Inside a git
// work tree that is what git tracks or would track, so ignored local files
// (handoffs, local settings) are skipped; elsewhere, every file.
function kitFiles(dir) {
  const git = spawnSync(
    'git',
    ['-C', dir, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { encoding: 'utf8' },
  );
  if (git.status === 0) {
    return git.stdout.split('\0').filter((path) => path && existsSync(join(dir, path)));
  }
  const files = [];
  const walk = (relative) => {
    for (const entry of readdirSync(join(dir, relative), { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  walk('');
  return files;
}

function checkLineEndings(dir) {
  const findings = [];
  for (const path of kitFiles(dir).sort()) {
    const bytes = readFileSync(join(dir, path));
    if (bytes.includes(0)) continue; // binary
    if (bytes.includes(0x0d)) findings.push(`${path}: has CRLF or CR line endings; use LF`);
  }
  return findings;
}

// NOTICE.md lists every copy with its upstream, pin and kind (ADR 0004).
// An entry is a table row whose first cell is the copy's name, whose pin cell
// holds at least the first seven characters of the pinned commit and whose
// kind is `copy`.
function checkNotice(dir) {
  const { copies } = readUpstreams(dir);
  if (copies.length === 0) return [];
  const full = join(dir, 'NOTICE.md');
  if (!existsSync(full)) return ['NOTICE.md: file is missing; it must list every copy (ADR 0004)'];
  const rows = readFileSync(full, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'))
    .map((line) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim()));
  const findings = [];
  for (const copy of copies) {
    const row = rows.find((cells) => cells[0].replace(/`/g, '') === copy.folder);
    const pin = copy.upstream.commit.slice(0, 7);
    if (!row) {
      findings.push(`NOTICE.md: no entry for copy "${copy.folder}" (ADR 0004)`);
    } else if (!(row[2] ?? '').includes(pin)) {
      findings.push(`NOTICE.md: entry "${copy.folder}" must show its pin ${pin} from ${UPSTREAMS_MANIFEST}`);
    } else if ((row[3] ?? '').replace(/`/g, '').toLowerCase() !== 'copy') {
      findings.push(`NOTICE.md: entry "${copy.folder}" must have kind "copy"`);
    }
  }
  return findings;
}

function validate(dir) {
  const findings = checkSkills(dir);
  const plugin = readJson(dir, PLUGIN_MANIFEST);
  const marketplace = readJson(dir, MARKETPLACE_MANIFEST);
  if (plugin.finding) findings.push(plugin.finding);
  if (marketplace.finding) findings.push(marketplace.finding);
  if (!plugin.finding) findings.push(...checkManifestListing(dir, plugin.value));
  if (!plugin.finding && !marketplace.finding) {
    findings.push(...checkVersions(plugin.value, marketplace.value));
  }
  findings.push(...checkCopies(dir));
  findings.push(...checkNotice(dir));
  findings.push(...checkLineEndings(dir));
  return findings;
}

const findings = validate(kitDir);

for (const finding of findings) console.log(finding);
if (findings.length > 0) {
  console.error(`${findings.length} finding(s) in ${kitDir}`);
  process.exit(1);
}
console.error(`kit valid: ${kitDir}`);
