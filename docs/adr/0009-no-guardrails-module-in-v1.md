# No guardrails module in v1; controls are earned through retro

The kit ships no agent hooks and no git hooks in v1. `aw-setup` only offers `permissions.deny` entries for `.claude/settings.json` (for example force-push and `--no-verify`), which need no scripts. A mechanical control is added only when `aw-retro` finds an error class that happened twice, at the highest rung of its ladder that works. That way controls come from observed errors, not from guesses.

## Considered Options

- **An optional guardrails module installed per repo** by `aw-setup`, with hooks for the agent and for git: deferred. Any such hook must come out of `aw-retro`.
- **Hooks shipped inside the Claude Code plugin**: rejected, because plugin hooks would run in every repo where the plugin is enabled, not just in the repos that use the workflow.
