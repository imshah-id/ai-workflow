# One flat skill tree, two install routes, Claude Code as reference harness

All skills live flat under `skills/<name>/SKILL.md`, with no bucket folders. The same tree is published two ways: as a Claude Code plugin whose repo is its own marketplace (`.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`), which Codex and Copilot CLI also read, and as an `npx skills add samfaina/ai-workflow` source for every other harness. Claude Code is the only harness the kit is tested on; the rest are supported through the `SKILL.md` standard, without any promise about hooks.

## Considered Options

- **Bucketed `skills/<group>/<name>/`** like Matt Pocock's repo: rejected because Codex's manifest historically took a single path and drops symlinks on install, which forced Pocock into a deferral (his ADR 0002). A flat tree has no such problem.
- **A single install route**: rejected. The plugin gives managed updates on Claude Code; `npx skills` is the only route for OpenCode and the like.

## Consequences

- Every skill must appear in `plugin.json`'s `skills` array, and the plugin `version` must be bumped on each release, or installed users never see the update.
- User-invoked skills need `disable-model-invocation: true` and, for Codex, an `agents/openai.yaml` that disables implicit invocation.
