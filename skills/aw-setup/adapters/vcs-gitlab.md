# VCS: git with GitLab merge requests

> Template for `aw-setup`: replace every `{{placeholder}}` with the value from the interview, set the access levels, and drop this note. A `<placeholder>` stays: the skill running the operation fills it in.

Read by the aw- skills through the `## Agent skills` block. Edit by hand or re-run `/aw-setup`.

- **Base branch:** `{{base-branch}}`. It is also the diff base.
- **Protected branches:** `{{protected-branches}}`, the base branch and any others the user named.
- **Branch naming:** `{{branch-pattern}}`, such as `<type>/<slug>`.
- **Commit convention:** {{commit-convention}}, such as Conventional Commits, `<type>: <summary>`.
- **Review host:** merge requests on GitLab, through the `glab` CLI.
- **Merge method:** `{{merge-method}}`: `merge`, `squash` or `rebase`.

**Default access:** `write`

## Access

`read` operations are always allowed. At `write` the agent performs the operation. At `draft` it writes the exact command, with any body text, to `.aw/drafts/<yyyymmdd-hhmmss>-<operation>.md`, tells the user the path, and goes on without performing it. A row whose Access differs from the default is an override.

`merge` at `write` is still conditional: the agent merges only when `aw-review` found no proven defect and the `full` check level passed.

## Never allowed

Whatever the access levels say, the agent never force-pushes (`--force`, `--force-with-lease`, a `+` refspec), never deletes a branch, local or remote, never pushes directly to a protected branch, and never passes `--no-verify`. These are not configurable.

## Operations

| Operation | How | Access |
| --- | --- | --- |
| `start-branch` | `git fetch origin`, then `git switch -c <branch> origin/{{base-branch}}`, naming the branch by the pattern above | `write` |
| `commit` | `git add <paths>`, then `git commit -F <message-file>`, with a message in the commit convention | `write` |
| `diff-base` | `git merge-base HEAD origin/{{base-branch}}`; the change under review is `git diff <that commit>...HEAD` | `read` |
| `push` | `git push -u origin <branch>`, from a branch that is not protected | `draft` |
| `open-review` | `glab mr create --source-branch <branch> --target-branch {{base-branch}} --title "<title>" --description "<body>" --yes` | `draft` |
| `merge` | `glab mr merge <n> --yes`, adding `--squash` or `--rebase` for those merge methods. Leave the source branch in place: never pass `--remove-source-branch` | `draft` |
