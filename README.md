# ai-workflow

A personal kit of agent skills in `SKILL.md` format that takes a task to a merged change: a spec when the change deserves one, evidence for every acceptance criterion, and a review before anything ships. It works with or without a tracker, on any VCS host. Every skill is named `aw-<name>`, so it never collides with another kit's skills.

Claude Code is the reference harness. Other harnesses (Codex, OpenCode, Cursor and the like) get the skills through the `SKILL.md` standard.

The vocabulary is in [`GLOSSARY.md`](GLOSSARY.md) and the design decisions in [`docs/adr/`](docs/adr/).

> Status: pre-release. The repo is a valid plugin and skills source. It ships eleven copies of Matt Pocock's skills and two of Addy Osmani's so far, listed in [`NOTICE.md`](NOTICE.md), and the first kit skill, `aw-check-spec`: the spec template and the script that checks specs under `docs/specs/`.

## Install

### As a Claude Code plugin (recommended)

The repo is its own marketplace. Add it once, then install the kit with project scope in each repo that uses the workflow, so other repos never see its skills:

```sh
claude plugin marketplace add samfaina/ai-workflow
claude plugin install ai-workflow@samfaina --scope project
```

The same steps work inside Claude Code as `/plugin marketplace add samfaina/ai-workflow` and `/plugin install ai-workflow@samfaina`, choosing project scope when asked.

Project scope writes the plugin to the repo's `.claude/settings.json`, so everyone who clones the repo gets the same kit. Updates arrive through Claude Code's plugin system whenever a release bumps the plugin version.

### With `npx skills`

For harnesses without Claude Code's plugin system:

```sh
npx skills add samfaina/ai-workflow
```

To install a single skill, name it:

```sh
npx skills add samfaina/ai-workflow --skill aw-<name>
```

Each skill folder is self-contained, with its license, references and scripts, so a single skill works on its own.

## Switching plugins on or off per repo

Claude Code decides which plugins are active in a repo from `enabledPlugins` in the settings files. Keys are `<plugin>@<marketplace>`. A project's `.claude/settings.json` (shared) or `.claude/settings.local.json` (yours only) overrides your user settings.

The usual setup keeps Matt Pocock's plugin installed at user scope and turns it off in the repos that use this kit, so the two kits never offer competing skills for the same phase:

```json
{
  "enabledPlugins": {
    "ai-workflow@samfaina": true,
    "mattpocock-skills@claude-plugins-official": false
  }
}
```

Use the key under which Pocock's plugin is installed on your machine. It depends on the marketplace you installed it from (`claude plugin list` shows it). From the command line:

```sh
claude plugin enable ai-workflow@samfaina --scope project
claude plugin disable mattpocock-skills@claude-plugins-official --scope project
```

To turn the kit off in one repo without uninstalling it, set `"ai-workflow@samfaina": false` in that repo's settings.

## Maintaining the kit

The scripts are dependency-free Node 18+ ESM, always run as `node <path>` (ADR 0008).

```sh
node --test                          # tests
node scripts/validate-kit.mjs        # kit invariants
claude plugin validate . --strict    # plugin and marketplace manifests
```

`scripts/validate-kit.mjs` checks that:

- every skill folder under `skills/` carries the `aw-` prefix and its `name:` matches the folder;
- every skill is listed in `.claude-plugin/plugin.json`, and every listed skill exists;
- user-invoked skills carry both `disable-model-invocation: true` and an `agents/openai.yaml` with `policy: allow_implicit_invocation: false`. A skill that declares either flag counts as user-invoked, so a skill meant to be user-invoked that declares neither is not caught;
- the version in `plugin.json` is plain semver `X.Y.Z` and matches the marketplace entry;
- every copy passes the sync `check` (below), which also requires its `LICENSE.upstream`;
- every copy has a `NOTICE.md` entry that links its upstream `repo` and shows its pin and the kind `copy`;
- text files use LF line endings.

It prints one finding per line and exits non-zero when it finds any. CI runs all three commands on every pull request.

### Copies and upstream sync

`upstreams.json` pins each upstream to a commit, records why that pin was chosen, and lists the skills copied from it. `upstreams.lock.json` holds the git tree hash of each copied upstream folder at the pin and the mode and blob hash of every file in it; `check` verifies that the file hashes add up to the tree hash. Both are maintained through `scripts/sync-upstreams.mjs` (ADR 0015):

```sh
node scripts/sync-upstreams.mjs install   # clone each upstream at its pin, write the copies and the lock
node scripts/sync-upstreams.mjs check     # offline: each copy equals its upstream plus the mechanical transform
node scripts/sync-upstreams.mjs report    # what changed upstream since each pin
```

`install` writes each copy to `skills/aw-<name>/` with the rename applied: the folder, the `name:` field, and references to copied skills. A reference is written in double quotes (`"tdd"`, as in Skill tool calls), as a slash command (`/tdd`), backticked before the word "skill" (`` the `tdd` skill ``) or as a backticked link text (``[`tdd`](SKILL.md)``). Any other use of a name, such as a bare backticked word or a path, is left alone, and `install` lists each quoted or backticked one it left, as `<file>:<line>: left alone: <mention>`, so the maintainer can tell whether one is a reference in a form the rename does not know yet.

`install` keeps `agents/`, adds the upstream license as `LICENSE.upstream`, and removes copies no longer listed. A copy must not be edited by hand: `check` fails on any other change, and on a missing rename. An upstream's `repo` can be a local directory holding a git repo, which is how the tests run offline.

To move a pin, change `commit` and `reason` in `upstreams.json`, run `install`, and update the pin in the copy's `NOTICE.md` entry. New copies also need a `NOTICE.md` entry and a line in `plugin.json`'s `skills`.

A release is a semver tag `vX.Y.Z`, the same `version` in `.claude-plugin/plugin.json` and the marketplace entry, and a hand-written `CHANGELOG.md` entry (ADR 0015). Without the version bump, installed plugin users never see the update.

The repo's own agent instructions live in `.claude/CLAUDE.md`, not at the root: `claude plugin validate --strict` rejects a root `CLAUDE.md`, because a plugin does not load it as project context.

## License

MIT, copyright `samfaina`. Copied and adapted skills are credited in [`NOTICE.md`](NOTICE.md).
