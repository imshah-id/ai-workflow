# A repo's verify skill lives in `.claude/skills/`

`aw-create-verify` writes a repo's verify skill to `.claude/skills/verify-<app>/`, committed with the project and with no `aw-` prefix, because the skill belongs to the repo, not to the kit. `aw-verify` looks for it at that path whatever the harness. The reason is that Claude Code, the reference harness, does not read `.agents/skills/`, and symlinking one folder into the other is unreliable on Windows. When a repo has no verify skill, every acceptance criterion needs `test:` or `manual:` evidence.
