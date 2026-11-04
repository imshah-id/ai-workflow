# Tracker: none

> Template for `aw-setup`: nothing to fill in. Drop this note.

Read by the aw- skills through the `## Agent skills` block. Edit by hand or re-run `/aw-setup`.

- **Kind:** no tracker. A task arrives as free text in the conversation, and the spec under `docs/specs/` is the durable record.
- **Writes:** with nowhere to write, every write operation leaves a draft, ready to file wherever the user tracks work. Setting one to `write` changes nothing.

**Default access:** `draft`

## Access

`read` operations are always allowed. At `draft` the agent writes the exact ticket text or comment to `.aw/drafts/<yyyymmdd-hhmmss>-<operation>.md`, tells the user the path, and goes on.

## Operations

| Operation | How | Access |
| --- | --- | --- |
| `fetch-ticket` | Nothing to fetch: take the task as the user stated it in the conversation | `read` |
| `query-tickets` | Nothing to query: there are no tickets | `read` |
| `publish-ticket` | Draft the ticket's title and body | `draft` |
| `comment-ticket` | Draft the comment text | `draft` |
| `set-status` | Draft a one-line note of the new state | `draft` |
| `link-tickets` | Draft a one-line note of the link | `draft` |
