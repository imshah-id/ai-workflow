# Kit skills speak canonical operations; per-repo adapters translate them

Kit skills never name a concrete tool. They request **canonical operations**, and per-repo files under `docs/agents/` translate those operations for the repo's actual tooling. The files are reached through an `## Agent skills` block in `AGENTS.md`, or in `CLAUDE.md` when only that exists. No skill names a `docs/agents/` file directly.

| File | Holds |
| --- | --- |
| `tracker.md` | Tracker kind, conventions, how each tracker operation is done, ticket states, access |
| `vcs.md` | Branch naming, commit convention, diff base, push, review host (PR, MR or none), access |
| `checks.md` | The command for each check level: `fast`, `task`, `full` |
| `domain.md` | Where the glossary and ADRs live (Matt Pocock's file, unchanged) |

The tracker and the VCS are separate files because they vary independently, for example Linear tickets with GitHub pull requests.

The canonical operations form a closed vocabulary:

- **Tracker:** `fetch-ticket`, `publish-ticket`, `comment-ticket`, `set-status`, `link-tickets`, `query-tickets`
- **VCS:** `start-branch`, `commit`, `diff-base`, `push`, `open-review`, `merge`
- **Checks:** `run-check <level>`

Each write operation has one of two access levels: `write`, where the agent performs it, or `draft`, where the agent writes the exact text or command to `.aw/drafts/` and a person applies it. Reading is always allowed. Each file declares a default level and optional per-operation overrides. Force-pushing, deleting branches and pushing directly to protected branches are never allowed and are not configurable. When `merge` is at `write`, it is still conditional (ADR 0013).

## Considered Options

- **Three levels: read, draft, write** (the initial draft): rejected. Under `read`, a write operation either leaves a draft, which makes it the same as `draft`, or silently does nothing, which is worse.
- **A `triage-labels.md` file** as in Pocock's setup: rejected. Ticket states live in `tracker.md`, and `triage` is not part of the kit.

## Consequences

`.aw/` is the kit's local, git-ignored working directory in each repo.
