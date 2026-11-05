---
name: aw-retro
description: "Retrospective on a coding session: turn every error class that happened twice into the highest control on the ladder that works (architecture, types, lint or check, behaviour test, docs), each proven to fail on the real case and pass on a correct one, plus navigation, coding-standards and tool-economy candidates. Architecture findings go to /aw-improve-codebase-architecture. Proposes only, and changes nothing until you approve. Run after /aw-ship, or after any session worth learning from."
disable-model-invocation: true
---

# Retro

Look back over a coding **session** and improve the agent's **environment** so the next run goes better: the checks, types, tests and docs around the code, never the code the session produced. This phase's artifact is the **proposed controls** (ADR 0010): a retro report under `.aw/retros/`, also given in chat.

Controls are earned (ADR 0009). An **error class** gets a control only once it has happened twice, and the control sits at the highest rung of the **ladder** that works. Every control carries its **demonstration**: a run where it fails on a real case from the session and a run where it passes on a correct one.

This skill proposes, then waits. Until the user approves a candidate, the user's working tree stays as it is: no edited file, no commit, no added control. Its runs happen in detached worktrees outside the repo, and the only file it writes is the **retro report**, which is local state.

## Configuration

Find the repo's `## Agent skills` block: look in `AGENTS.md`, then `CLAUDE.md`, then `.claude/CLAUDE.md`, and follow its pointers to the tracker, VCS and checks adapters and the domain doc. Use each operation the way the adapter's Operations table says, at its access level: a write at `draft` is not performed; write its exact command or text to `.aw/drafts/<yyyymmdd-hhmmss>-<operation>.md` and tell the user the path. Where the block or an adapter is missing, use the defaults below. This skill uses `diff-base` and `run-check` to propose, and `start-branch` and `commit` only for approved candidates.

## Defaults when unconfigured

When the block or an adapter is missing, a skill keeps going on these defaults and says once per session: "using defaults, run `/aw-setup`".

| Adapter | Default |
| --- | --- |
| Tracker | `none`: the task arrives as free text, reads find nothing, and every write leaves a draft. `aw-wayfinder`, which needs a tracker, offers to create a local-markdown one. |
| VCS | git. The base branch and diff base are the default branch (`git symbolic-ref refs/remotes/origin/HEAD`, else `main` or `master`), which is also the one protected branch. `start-branch` and `commit` are at `write`; `push`, `open-review` and `merge` are at `draft`. |
| Checks | No configured commands. A skill proposes commands from the project's manifest, runs them when it needs a level, and never reports a level as passed unless it ran it. |
| Domain | Single-context: `GLOSSARY.md` and `docs/adr/` at the root, read when present. |

## Never allowed

Whatever the access levels say, the agent never force-pushes (`--force`, `--force-with-lease`, a `+` refspec), never deletes a branch, local or remote, never pushes directly to a protected branch, and never passes `--no-verify`. These are not configurable.

## The ladder

An **error class** is a kind of mistake, not one instance of it: "imported a server module into client code", not "the import on line 12". Two **occurrences** are two separate moments where the class happened, each traced to the session's record or to the **Seen once** list of an earlier retro report. The same mistake reported twice, once by a failing test and once by the review, is one occurrence.

The rungs, highest first. A higher rung makes the mistake harder to make; a lower one only makes it easier to catch:

1. **Architecture**: a change of structure that makes the error class impossible to write, such as one deep module owning a rule that callers keep getting wrong, or a seam that removes the hidden dependency. This skill does not build it: the finding goes to `/aw-improve-codebase-architecture` (step 6), with the demonstration the new structure must pass.
2. **Types**: a type that rejects the mistake at compile time, such as a branded type, a narrower union, or a required field.
3. **Lint or check**: a deterministic check that fails on the mistake: a rule in the repo's own linter, a script under the checks adapter's levels, a CI job, a pre-commit hook (which ADR 0009 allows only when it comes out of a retro like this one), or a `permissions.deny` entry.
4. **Behaviour test**: a test at an existing seam that fails while the mistake is in the code.
5. **Docs**: prose, for judgement calls no tool can decide: a rule in `CODING_STANDARDS.md`, which the reviewer reads, or a doc reached by a **context pointer**, as `aw-writing-for-agents` defines it.

The highest control that **works** is the first rung, walking down, whose control covers the whole class, not only the two occurrences, and passes its demonstration. Skip a rung the repo's language or tooling cannot support, and say why in one line.

**The demonstration.** Every control is proven by two runs, made in a detached worktree at `HEAD` with the control added there, as **Where runs happen** says, each with its exact command and quoted output:

- **Pass:** the control accepts a **correct case**, the code as the session fixed it, which is usually `HEAD` itself. Run the control over the whole repo at `HEAD` too: when it flags other code, those are further occurrences or the control is too broad; report which, and narrow it or add the occurrences to the candidate.
- **Fail:** the control rejects a **real case**, one occurrence from the session put back into that same worktree: reverse the session's fix (`git show <fix commit> -- <files> | git apply -R`), or apply the hunk where the mistake landed. When neither applies cleanly to `HEAD`, restore the occurrence by hand from its hunk and say so. A synthetic example is not a real case.

For a docs control, both runs use a subagent with a fresh context window that gets only the doc and the case: it must flag the mistake in the real case and raise nothing on the correct one. When a control fails either run, drop to the next rung and prove that one.

An architecture finding cannot be proven here, since its structure does not exist yet. It states its demonstration instead, the two runs the new structure must pass: the real case no longer compiles, runs or can be written, and the correct case still does.

**Where runs happen.** Every run is made in a detached worktree outside the repo, never in the user's working tree: `git worktree add --detach <tmp>/retro <commit>`, where `<tmp>` is a new directory under the system's temporary directory. Install the project's dependencies there the way its manifest says before the first run. Remove the worktree when its runs are done, with `git worktree remove --force <dir>`, which removes no branch.

## Improvement categories

Beside error classes, look for three kinds of candidate, as Pocock's `retro` does. A coding-standards miss is an error class and needs two occurrences. A navigation or tool-economy friction is a cost, not a mistake, and one traced moment is enough when it was expensive.

- **Navigation**: the session searched long for a file or fact, or tripped on a hidden dependency between files. The control is a **context pointer** from a file the agent already reads, worded with the trigger that should send the agent there. Its demonstration: the session's search is the fail; a fresh-context subagent given the pointer and the same question reaching the answer directly is the pass.
- **Coding standards**: `aw-review`'s Standards axis, or the reviewer, missed a mistake. Classify it first. A **mechanical** violation (a banned API, an import shape, a file-location rule, a fixed syntactic shape) goes to the lint-or-check rung or higher, whichever the repo's linter and existing checks make cheapest. Only a genuine **judgement call** becomes a rule in `CODING_STANDARDS.md`, proposed at the docs rung, and the first such rule creates the file. Standards belong to the reviewer, who reads a diff with little context pressure, not to `AGENTS.md` or `CLAUDE.md`, which load into every session and stay for context pointers.
- **Tool economy**: the session made an expensive tool call for what it returned, such as reading whole files for one line, or a CLI or MCP tool that floods the context. The control streamlines the call: a narrower command, a script that returns only what is needed, or a pointer to the cheaper tool. Its demonstration: the session's call and its output size are the fail; the streamlined call returning the same answer for less is the pass.

## Steps

### 1. Load the writing guide

Call the Skill tool with "aw-writing-for-agents". Every steering text this skill proposes, a pointer, a rule or a doc, follows it.

Done when the guide is loaded.

### 2. Read the session

Read the primary sources for the session the user names, which may mean searching the session logs on this machine; when they name none, take the current one. Read alongside it the record the workflow left:

- the commits of the session's branch, `git log <base>..HEAD`, with `diff-base` for the base;
- the review reports under `.aw/reviews/`, the verify results under the spec's `verify/` folder, and the drafts under `.aw/drafts/`;
- earlier retro reports under `.aw/retros/`: each **Seen once** entry there is an occurrence from an earlier session.

List every mistake, struggle and expensive call, each with where it happened: a message, a tool call, a commit, a report line. Leave out anything you cannot trace to a moment in the record.

Done when every entry on the list cites its source.

### 3. Group into classes and count

Group the list into error classes and frictions, and count each one's occurrences. An error class with two or more occurrences is a **candidate**, and so is an expensive navigation or tool-economy friction (see **Improvement categories**). An error class seen once is **seen once**: no control is proposed for it, and the report keeps it so that a later retro can count it.

Done when every entry belongs to a candidate or to the seen-once list.

### 4. Read the repo's existing controls

Read the repo's checks first: the checks adapter's levels, the project manifest's `lint`, `check`, `typecheck` and `test` scripts, linter configs, CI workflows, and any pre-commit hook. When a control that would catch a candidate already exists but is unwired, skipped or silently broken, wiring or fixing it is the candidate's control, at that control's rung.

When the repo wires no check at all, no CI job and no hook that runs its checks, report that as a finding of its own.

Done when each candidate is marked with the existing control that covers it, if any.

### 5. Find each candidate's rung

For each candidate, walk **The ladder** from the top. At each rung, sketch the control and judge whether it covers the class. At the first rung where one does, prove it with its demonstration; when the demonstration fails, go down a rung. Navigation and tool-economy candidates take their control from **Improvement categories**, proven the same way.

Done when every candidate has one control with both runs quoted, or is an architecture finding.

### 6. Hand off architecture findings

When the class is best fixed by a change of structure, write it as an **architecture finding**: the class, its occurrences, the modules involved, why no lower rung covers it as well, and the demonstration the new structure must pass (**The ladder**). Tell the user to run `/aw-improve-codebase-architecture`, pointed at those modules; this skill never runs it.

Then keep walking down the ladder, and propose the highest lower rung that works as a stopgap until the structure changes, proven as usual. When none works, say so.

Done when every architecture finding names its modules and its demonstration, and has a proven stopgap or the reason it has none.

### 7. Write the report and wait

Write the report to `.aw/retros/<yyyymmdd-hhmmss>-retro.md`, local state that is never committed, in this shape, candidates most severe first:

```markdown
# Retro: <session or branch>, <yyyy-mm-dd>

## Candidates

### <n>. <error class or friction>

- **Occurrences:** <each with its source in the record>
- **Rung:** <architecture, types, lint or check, behaviour test, or docs>, because <why no higher rung works>
- **Control:** <what to add or wire, and the files it touches>
- **Fails on the real case:** `<command>` at <case> → <quoted output>
- **Passes on a correct case:** `<command>` at <case> → <quoted output>; whole repo at HEAD: <clean, or what it flagged>

## Architecture findings

<Each with its occurrences, its modules for `/aw-improve-codebase-architecture`, the demonstration the new structure must pass, and its stopgap candidate's number or why it has none; or "None.">

## Seen once

<Each class or friction with its one occurrence; or "None.">
```

Rank severity by what the class costs when it recurs and how often it would, not by how loudly it showed up in the session.

Give the report in chat with its path, and ask the user which candidates to apply. Then stop. Approval is explicit, in the conversation, per candidate; silence or "looks good" on the report as a whole approves nothing.

Done when the report is written and given, and the user has said which candidates to apply, or none.

### 8. Apply the approved candidates

Only for the candidates the user approved:

1. **Take a work branch.** Use `start-branch` from the base for the controls, unless the user names another work branch. Never commit on a protected branch. When the working tree holds uncommitted changes, ask whether to set them aside or keep them; never stage them with the control.
2. **Add the control** as the report describes it, and nothing else.
3. **Run the pass again:** the control passes on the working tree, and `run-check task` passes. When either fails, undo the control's edits, and report the output for that candidate.
4. **Commit** each control on its own with `commit`, in the commit convention. When a commit hook fails, fix what it reports and commit again; never pass `--no-verify`.
5. **Run the fail again** in a detached worktree at that commit, as **Where runs happen** says, with the real case put back: the control still rejects it. When it does not, report it: the commit stays on the work branch for the user to keep or revert.

Done when every approved candidate is committed with both runs matching the report, or you have said why not.

### 9. Report

Report in chat: the report's path, each approved candidate with its commit or the reason it was not applied, the architecture findings, and the seen-once classes.

Then name what comes next, and tell the user to run it; this skill never runs it. With committed controls, run `/aw-review`, giving it each control's two runs as its done-when criteria, then `/aw-ship`. With architecture findings, run `/aw-improve-codebase-architecture`. With nothing approved, nothing comes next.
