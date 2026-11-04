// Helpers shared by the CLI tests: writing fixture kits, running a CLI the
// way CI runs it, and asserting on its findings. Not a test file itself.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
export const validateCli = join(repoRoot, 'scripts', 'validate-kit.mjs');
export const syncCli = join(repoRoot, 'scripts', 'sync-upstreams.mjs');

export const json = (value) => JSON.stringify(value, null, 2) + '\n';

// Writes each relative path's content: a string, a Buffer, or an object
// written as JSON. An undefined content is skipped.
export function writeFiles(dir, files) {
  for (const [path, content] of Object.entries(files)) {
    if (content === undefined) continue;
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    const isRaw = typeof content === 'string' || Buffer.isBuffer(content);
    writeFileSync(full, isRaw ? content : json(content));
  }
}

// The plugin and marketplace manifests of a fixture kit listing `skills`.
export function manifests(skills) {
  return {
    '.claude-plugin/plugin.json': {
      name: 'fixture-kit',
      version: '1.2.3',
      skills: skills.map((name) => `./skills/${name}`),
    },
    '.claude-plugin/marketplace.json': {
      name: 'fixture-kit',
      owner: { name: 'fixture' },
      plugins: [{ name: 'fixture-kit', source: './', version: '1.2.3' }],
    },
  };
}

// Runs a CLI with node; every non-blank stdout line is a finding.
export function runCli(cli, ...args) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  const findings = result.stdout.split('\n').filter((line) => line.trim() !== '');
  return { status: result.status, findings, stdout: result.stdout, stderr: result.stderr };
}

// Asserts the CLI passed with no findings.
export function assertNoFindings({ status, findings, stderr }) {
  assert.deepEqual(findings, [], stderr);
  assert.equal(status, 0);
}

// Asserts the CLI failed with exactly one finding, and that it matches.
export function assertOneFinding({ status, findings }, pattern) {
  assert.equal(findings.length, 1, `expected one finding, got:\n${findings.join('\n')}`);
  assert.match(findings[0], pattern);
  assert.notEqual(status, 0);
}
