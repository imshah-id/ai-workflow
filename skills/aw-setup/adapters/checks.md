# Checks

> Template for `aw-setup`: replace each `{{placeholder}}` with the command the user confirmed, and drop this note. A `<placeholder>` stays: the skill running the check fills it in.

Read by the aw- skills through the `## Agent skills` block. Edit by hand or re-run `/aw-setup`.

Commands run from the repo root. A level set to `none` has no command: it is reported as not run, never as passed.

## Levels

| Level | Command | Scope |
| --- | --- | --- |
| `fast` | `{{fast-command}}` | Seconds: lint, format check, typecheck. Run often while working. |
| `task` | `{{task-command}}` | Proves one slice: `fast` plus the tests the slice touches, with a `<files>` placeholder for them. Run before each commit. |
| `full` | `{{full-command}}` | Everything CI runs. Run before shipping. |

## Operations

| Operation | How | Access |
| --- | --- | --- |
| `run-check` | `run-check <level>`: run the level's command from **Levels**. Exit 0 is a pass; any other exit is a failure, reported with its output. Report a level as passed only after running it in this session | `read` |
