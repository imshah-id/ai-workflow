# Tracker: GitHub

> Template for `aw-setup`: replace every `{{placeholder}}` with the value from the interview, set the access levels, and drop this note. A `<placeholder>` stays: the skill running the operation fills it in.

Read by the aw- skills through the `## Agent skills` block. Edit by hand or re-run `/aw-setup`.

- **Kind:** GitHub Issues in `{{owner}}/{{repo}}`, through the `gh` CLI. `gh` infers the repo from `git remote -v` inside the clone.
- **Ticket key:** `#<n>`. GitHub shares one number space between issues and pull requests; `gh issue view <n>` fails on a pull request.
- **Specs:** tickets link to a spec under `docs/specs/`; they never hold one.

**Default access:** `write`

## Access

`read` operations are always allowed. At `write` the agent performs the operation. At `draft` it writes the exact command, with any body text, to `.aw/drafts/<yyyymmdd-hhmmss>-<operation>.md`, tells the user the path, and goes on without performing it. A row whose Access differs from the default is an override.

## Operations

| Operation | How | Access |
| --- | --- | --- |
| `fetch-ticket` | `gh issue view <n> --json number,title,body,labels,state,assignees,comments` | `read` |
| `query-tickets` | `gh issue list --state open --json number,title,labels,assignees`, narrowed with `--label <label>`, `--assignee <login>` or `--search "<query>"` | `read` |
| `publish-ticket` | `gh issue create --title "<title>" --body-file <file>`, one `--label <label>` per label | `write` |
| `comment-ticket` | `gh issue comment <n> --body-file <file>` | `write` |
| `set-status` | The command for the target state in **States** below | `write` |
| `link-tickets` | Blocked by: `gh api --method POST repos/{owner}/{repo}/issues/<n>/dependencies/blocked_by -F issue_id=<blocker-id>`, where `<blocker-id>` is the blocker's database id from `gh api repos/{owner}/{repo}/issues/<blocker> --jq .id`. `gh api` fills in `{owner}` and `{repo}` from the clone. Part of: `gh issue edit <parent> --add-sub-issue <n>`. Where either is unavailable, put `Blocked by: #<blocker>` or `Part of #<parent>` at the top of the ticket body | `write` |

## States

| State | How |
| --- | --- |
| `open` | An open issue with no assignee: `gh issue reopen <n>` if it is closed, `gh issue edit <n> --remove-assignee @me` if it is assigned |
| `in-progress` | `gh issue edit <n> --add-assignee @me` |
| `done` | `gh issue close <n> --reason completed` |
