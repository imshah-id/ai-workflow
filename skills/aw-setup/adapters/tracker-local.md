# Tracker: local markdown

> Template for `aw-setup`: replace every `{{placeholder}}` with the value from the interview, set the access levels, and drop this note. A `<placeholder>` stays: the skill running the operation fills it in.

Read by the aw- skills through the `## Agent skills` block. Edit by hand or re-run `/aw-setup`.

- **Kind:** one markdown file per ticket in `{{tickets-dir}}` (default `docs/tickets/`), committed with the repo.
- **Kept apart from specs:** the tickets folder is never `docs/specs/` or inside it. A ticket may link to a spec; it never holds one.
- **Ticket key:** the file's number, `NN`, or its path.
- **Ticket file:** `{{tickets-dir}}/<NN>-<slug>.md`, numbered from `01`. `Spec:`, `Part of:` and `Blocked by:` appear only when they apply:

  ```markdown
  # <title>

  Status: open
  Spec: docs/specs/<slug>/spec.md
  Part of: <NN>
  Blocked by: <NN>, <NN>

  <body>

  ## Comments
  ```

**Default access:** `write`

## Access

`read` operations are always allowed. At `write` the agent performs the operation. At `draft` it writes the exact file content or edit to `.aw/drafts/<yyyymmdd-hhmmss>-<operation>.md`, tells the user the path, and goes on without performing it. A row whose Access differs from the default is an override. Ticket files are committed like any other change, through the VCS adapter's `commit`.

## Operations

| Operation | How | Access |
| --- | --- | --- |
| `fetch-ticket` | Read `{{tickets-dir}}/<NN>-*.md` | `read` |
| `query-tickets` | List `{{tickets-dir}}/*.md` and read each file's `Status:`, `Part of:` and `Blocked by:` lines | `read` |
| `publish-ticket` | Create `{{tickets-dir}}/<NN>-<slug>.md` in the format above, `NN` one past the highest existing number | `write` |
| `comment-ticket` | Append the comment under `## Comments`, as a `### <yyyy-mm-dd>` heading followed by the text | `write` |
| `set-status` | Replace the `Status:` line with the target state from **States** below | `write` |
| `link-tickets` | Add the blocker to the `Blocked by:` line, or set the `Part of:` line, adding the line under `Status:` if absent | `write` |

## States

| State | How |
| --- | --- |
| `open` | `Status: open` |
| `in-progress` | `Status: in-progress` |
| `done` | `Status: done` |
