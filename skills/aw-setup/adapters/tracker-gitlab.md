# Tracker: GitLab

> Template for `aw-setup`: replace every `{{placeholder}}` with the value from the interview, set the access levels, and drop this note. A `<placeholder>` stays: the skill running the operation fills it in.

Read by the aw- skills through the `## Agent skills` block. Edit by hand or re-run `/aw-setup`.

- **Kind:** GitLab Issues in `{{group}}/{{project}}`, through the `glab` CLI. `glab` infers the project from `git remote -v` inside the clone.
- **Ticket key:** `#<n>`. GitLab numbers issues and merge requests separately.
- **Specs:** tickets link to a spec under `docs/specs/`; they never hold one.

**Default access:** `write`

## Access

`read` operations are always allowed. At `write` the agent performs the operation. At `draft` it writes the exact command, with any body text, to `.aw/drafts/<yyyymmdd-hhmmss>-<operation>.md`, tells the user the path, and goes on without performing it. A row whose Access differs from the default is an override.

## Operations

| Operation | How | Access |
| --- | --- | --- |
| `fetch-ticket` | `glab issue view <n> --comments` | `read` |
| `query-tickets` | `glab issue list -O json`, narrowed with `--label <label>`, `--assignee <user>` or `--search "<query>"` | `read` |
| `publish-ticket` | `glab issue create --title "<title>" --description "<body>" --label "<label>,<label>" --yes` | `write` |
| `comment-ticket` | `glab issue note <n> --message "<body>"` | `write` |
| `set-status` | The command for the target state in **States** below | `write` |
| `link-tickets` | Blocked by: `glab issue note <n> --message "/blocked_by #<blocker>"` (native blocking links need GitLab Premium). Part of: `Part of #<parent>` at the top of the description. Without native links, put `Blocked by: #<blocker>` at the top of the description | `write` |

## States

| State | How |
| --- | --- |
| `open` | An open issue with no assignee: `glab issue reopen <n>` if it is closed, `glab issue update <n> --unassign` if it is assigned |
| `in-progress` | `glab issue update <n> --assignee @me` |
| `done` | `glab issue close <n>`, after a `comment-ticket` that says why, since `glab issue close` takes no comment |
