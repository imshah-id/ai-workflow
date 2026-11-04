# Housekeeping

Four repo-level changes `aw-setup` checks on every run. Each one is idempotent: a re-run finds it already applied and changes nothing.

## `.aw/` in `.gitignore`

`.aw/` is the kit's local working directory; drafts go to `.aw/drafts/`. It is never committed.

- **Explore:** does `.gitignore` exist, and does a line already ignore the folder (`.aw`, `.aw/`, `/.aw` or `/.aw/`)?
- **Write, without asking:** when no such line exists, append `.aw/` on its own line, creating `.gitignore` if needed. Mention it in the report.

## `permissions.deny` entries (Claude Code)

Basic protection with no hook scripts (ADR 0009). The agent never force-pushes or skips hooks whatever the settings say; these entries make Claude Code refuse the commands too.

- **Explore:** read `permissions.deny` in `.claude/settings.json`.
- **Offer** the entries below that are missing. Offer them for `.claude/settings.json` (shared with everyone on the repo); write them to `.claude/settings.local.json` instead if the user prefers to keep them personal.

  ```json
  "Bash(git push --force*)",
  "Bash(git push * --force*)",
  "Bash(git push -f*)",
  "Bash(git push * -f*)",
  "Bash(git push * +*)",
  "Bash(git * --no-verify*)",
  "Bash(git commit -n*)",
  "Bash(git commit * -n*)"
  ```

  `--force*` also covers `--force-with-lease` and `--force-if-includes`, and `+*` covers a forced refspec such as `+main`. When the harness runs shell commands through a PowerShell tool as well (Claude Code on Windows), offer each entry a second time with `PowerShell(` in place of `Bash(`.
- **Write, on yes:** add only the missing entries to the `permissions.deny` array, creating `permissions` or `deny` if absent. Keep every other setting and entry as it is, and write valid JSON.

Other harnesses have no `permissions.deny`; skip this offer there.

## Node

`aw-check-spec` validates specs with a Node script (ADR 0012).

- **Explore:** run `node --version`.
- **Warn** when it fails or reports a major version below 18: "Node 18 or later not found. `aw-check-spec` cannot run its script, so specs are checked by reading and the result is never script-verified. Install Node 18+ to get the script-verified spec check." Setup carries on either way.

## Matt Pocock's plugin (Claude Code)

The two kits offer competing skills for the same phases, so Pocock's plugin stays installed at user scope and is turned off per repo.

- **Explore:** Pocock's plugin is enabled in this repo when an `enabledPlugins` key naming it (`mattpocock-skills@<marketplace>`, as `claude plugin list` shows) is `true` in `~/.claude/settings.json` and not set to `false` in `.claude/settings.json` or `.claude/settings.local.json`. Skills offered as `mattpocock-skills:<name>` in this session also show it is on.
- **Offer**, when enabled, to turn it off for this repo only: set `"mattpocock-skills@<marketplace>": false` under `enabledPlugins` in `.claude/settings.json`, or in `.claude/settings.local.json` if the user prefers. Update an existing key rather than adding a second one. On no, mention in the report that both kits' skills stay on.

The user-scope install is never touched.
