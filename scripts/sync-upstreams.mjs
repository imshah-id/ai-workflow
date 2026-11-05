// Upstream sync CLI (maintainer-only, never ships to user repos). ADR 0015.
//
// Usage: node scripts/sync-upstreams.mjs <install|check|report> [kit-dir]
//
//   install  clones each upstream in upstreams.json at its pin, writes the
//            copies with the mechanical transform applied and LICENSE.upstream
//            added, and rewrites upstreams.lock.json. Fails, writing nothing,
//            when a copy refers to a skill of its upstream that the kit
//            neither copies nor replaces. Needs the network unless every
//            upstream is a local directory.
//   check   verifies offline that each copy equals its upstream at the pin
//            plus the mechanical transform, against upstreams.lock.json.
//            Prints one finding per line as `<path>: <message>`.
//   report   lists what changed upstream since each pin. Needs the network
//            unless every upstream is a local directory.
//
// Exits 0 on success, 1 when check has findings or install/report fail, 2 on
// a usage error.

import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { check, install, report, SyncError } from './lib/upstreams.mjs';

const USAGE = 'usage: node scripts/sync-upstreams.mjs <install|check|report> [kit-dir]';
const [mode, target] = process.argv.slice(2);
const kitDir = resolve(target ?? '.');

if (!['install', 'check', 'report'].includes(mode)) {
  console.error(USAGE);
  process.exit(2);
}
if (!existsSync(kitDir) || !statSync(kitDir).isDirectory()) {
  console.error(`${USAGE}\nnot a directory: ${kitDir}`);
  process.exit(2);
}

if (mode === 'check') {
  const findings = check(kitDir);
  for (const finding of findings) console.log(finding);
  if (findings.length > 0) {
    console.error(`${findings.length} finding(s) in ${kitDir}`);
    process.exit(1);
  }
  console.error(`copies match their upstreams: ${kitDir}`);
} else {
  try {
    const lines = mode === 'install' ? install(kitDir) : report(kitDir);
    for (const line of lines) console.log(line);
  } catch (error) {
    if (!(error instanceof SyncError)) throw error;
    console.error(error.message);
    process.exit(1);
  }
}
