# Unconfigured repos run on safe defaults instead of stopping

When a repo has no `docs/agents/` configuration, kit skills keep going on safe defaults and say once: "using defaults, run `/aw-setup`". Matt Pocock's skills stop and ask for setup instead. The defaults:

- **Tracker `none`:** `aw-intake` takes the task as free text. `aw-wayfinder` is the one skill that needs a tracker, and it offers to create a local-markdown one.
- **VCS:** git, with `push`, `open-review` and `merge` at `draft`.
- **Checks:** without `checks.md`, a skill proposes commands from the project's manifest, but never reports a check level as passed unless it ran it.

## Considered Options

- **Local markdown as the default tracker** (the initial draft): rejected. Slices already live in the spec (ADR 0010), so a local tracker by default would only duplicate them.
