# Tracker: {{name}}

> Template for `aw-setup`: replace each `{{placeholder}}` from the user's description of their tracker, set the access levels, and drop this note. An operation the tracker cannot do says so in its How cell.

Read by the aw- skills through the `## Agent skills` block. Edit by hand or re-run `/aw-setup`.

- **Kind:** {{name, such as Jira or Linear, and the project or team}}, used through {{CLI, API or web UI}}.
- **Ticket key:** {{format, such as `ABC-123`}}.
- **Specs:** tickets link to a spec under `docs/specs/`; they never hold one.

{{The user's description of how they work with the tracker, in their words.}}

**Default access:** `draft`

## Access

`read` operations are always allowed. At `write` the agent performs the operation. At `draft` it writes the exact command or text to `.aw/drafts/<yyyymmdd-hhmmss>-<operation>.md`, tells the user the path, and goes on without performing it. A row whose Access differs from the default is an override. Keep an operation at `draft` until its How has run once and worked.

## Operations

| Operation | How | Access |
| --- | --- | --- |
| `fetch-ticket` | {{how to read one ticket with its comments}} | `read` |
| `query-tickets` | {{how to list open tickets, and filter them}} | `read` |
| `publish-ticket` | {{how to create a ticket with a title and body}} | `draft` |
| `comment-ticket` | {{how to comment on a ticket}} | `draft` |
| `set-status` | {{how to move a ticket to each state in **States** below}} | `draft` |
| `link-tickets` | {{how to mark one ticket as blocked by another, or as part of a parent}} | `draft` |

## States

| State | How |
| --- | --- |
| `open` | {{the tracker's state for not started}} |
| `in-progress` | {{the tracker's state for being worked on}} |
| `done` | {{the tracker's state for finished}} |
