# Kit skills speak canonical operations; per-repo adapters translate them

Kit skills never name a concrete tool. They request **canonical operations**, and per-repo files under `docs/agents/` translate those operations for the repo's actual tooling. The files are reached through an `## Agent skills` block in `AGENTS.md`, or in `CLAUDE.md` when only that exists. No skill names a `docs/agents/` file directly, except a skill that writes an adapter, which has to name the path it writes. Two skills do: `aw-setup`, which writes the files below and first looks for earlier ones and for Pocock's `issue-tracker.md`, and `aw-wayfinder`, which offers a local-markdown tracker when the repo has none and writes it to `docs/agents/tracker.md` when no block points to a tracker adapter. `aw-wayfinder` works when installed alone, so it cannot leave this to `aw-setup`. Once written, an adapter is reached through the block like any other.

| File | Holds |
| --- | --- |
| `tracker.md` | Tracker kind, conventions, how each tracker operation is done, ticket states, access |
| `vcs.md` | Branch naming, commit convention, diff base, push, review host (PR, MR or none), access |
| `checks.md` | The command for each check level: `fast`, `task`, `full` |
| `domain.md` | Where the glossary and ADRs live (Matt Pocock's file; only the copied skills it mentions are renamed, with the `aw-` prefix of ADR 0001) |

The tracker and the VCS are separate files because they vary independently, for example Linear tickets with GitHub pull requests.

The canonical operations form a closed vocabulary:

- **Tracker:** `fetch-ticket`, `publish-ticket`, `comment-ticket`, `set-status`, `link-tickets`, `query-tickets`
- **VCS:** `start-branch`, `commit`, `diff-base`, `push`, `open-review`, `merge`
- **Checks:** `run-check <level>`

Each write operation has one of two access levels: `write`, where the agent performs it, or `draft`, where the agent writes the exact text or command to `.aw/drafts/` and a person applies it. Reading is always allowed. The tracker and VCS files each have a **Default access** line, and the Access column of their Operations table gives each write operation's effective level; read operations are marked `read`. A row whose Access differs from the default is an override. A fixed set of operations is never allowed, and no access level or override changes that; the list is the `## Never allowed` section of `docs/configuration.md`. When `merge` is at `write`, it is still conditional (ADR 0013).

## Considered Options

- **Three levels: read, draft, write** (the initial draft): rejected. Under `read`, a write operation either leaves a draft, which makes it the same as `draft`, or silently does nothing, which is worse.
- **A default level plus a separate list of per-operation overrides** (the earlier wording of this ADR): rejected. With the effective level on every row, the table shows each operation's level at a glance, and `scripts/validate-kit.mjs` can check every row.
- **A `triage-labels.md` file** as in Pocock's setup: rejected. Ticket states live in `tracker.md`, and `triage` is not part of the kit.

## Consequences

`.aw/` is the kit's local, git-ignored working directory in each repo.
