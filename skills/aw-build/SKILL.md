---
name: aw-build
description: "Build one slice of an approved spec per call: on a work branch, test-first with aw-tdd at the agreed seams, then run the task checks, tick the slice, update Traceability and commit locally. Stops with a proposed spec change when the spec is wrong. Run after /aw-slices, once per slice."
disable-model-invocation: true
---

# Build

Build **one slice** of an approved spec per call, on a work branch: test-first at the seams the spec's Test strategy agrees, then run the `task` check level, tick the slice, update Traceability and make one local commit. The commits and the spec's Traceability are this phase's artifact. Building never starts a review: review is a phase of its own.

This skill edits only three things in the spec: the slice's done marker, a **test exception** in the slice it builds, and the Traceability rows of the criteria that slice covers. Anything else the spec needs is a **spec change**: stop, as **When the spec is wrong** says.

## Configuration

Find the repo's `## Agent skills` block: look in `AGENTS.md`, then `CLAUDE.md`, then `.claude/CLAUDE.md`, and follow its pointers to the tracker, VCS and checks adapters and the domain doc. Use each operation the way the adapter's Operations table says, at its access level: a write at `draft` is not performed; write its exact command or text to `.aw/drafts/<yyyymmdd-hhmmss>-<operation>.md` and tell the user the path. Where the block or an adapter is missing, use the defaults below.

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

## The done marker

Each slice in the spec's Slice plan opens with a checkbox, its **done marker**: `[ ]` until the slice is built, `[x]` once this skill has built it:

```markdown
1. [x] <Slice name> (AC-1, AC-3). AFK.
   - Delivers: <the end-to-end behaviour this slice makes work>
   - Blocked by: none.
2. [ ] <Slice name> (AC-2). HITL.
   - Delivers: <…>
   - Blocked by: 1.
```

A slice is **done** when its marker is `[x]`. `/aw-slices` writes every slice with the marker unset. A slice plan written before the marker existed has no checkboxes: add `[ ]` to every slice when you tick the first one.

## Steps

### 1. Take the spec and the slice

Take the spec the user names, or the one `/aw-slices` planned in this conversation. When neither is clear, list the specs under `docs/specs/` with their `status` and ask which one.

The fast route, with intake's "done when" criteria and no spec, is not covered by this skill yet: say so and stop.

Read the spec's frontmatter. **Refuse to go on unless `status` is `approved`**, and say why:

- `draft`: the spec has not passed spec approval. Tell the user to finish it with `/aw-spec` and approve it there.
- `implemented`: the spec is built. To change it, run `/aw-spec`, which sets it back to `draft` for the change and asks for approval again.
- `superseded`: name the spec its `superseded-by` points to.

Never set or change `status` yourself. Refuse as well when the Slice plan holds no numbered slices: tell the user to run `/aw-slices`.

Then call the Skill tool with "aw-check-spec" and run it on the repo. When it reports a finding on this spec, stop: report the findings; fixing them is a spec change. When it reports `Result: not script-verified`, Node is missing: say so, and go on.

Pick the slice: the one the user names, or else the first slice in plan order that is not done and whose blockers are all done. Refuse a slice whose blockers are not all done, and name them. When every slice is done, say so and name `/aw-verify` as the next skill.

When the slice is **HITL**, tell the user now what they will be needed for, from the slice's name and Delivers line, and ask before the step that needs them.

Done when you can name the spec, the one slice this call builds, its criteria, and AFK or HITL.

### 2. Start the work branch

Run `git status`. When the working tree has changes this skill did not make, ask the user whether to commit, set aside or keep them before going on: they must not land in this slice's commit.

When the current branch is protected (the base branch or another the VCS adapter names), use `start-branch` to create the work branch, named by the adapter's branch naming from the spec's slug, such as `feat/<slug>`. When the current branch is already a work branch for this spec, from an earlier slice, stay on it. When `start-branch` is at `draft`, write the draft, tell the user to create the branch with it and run `/aw-build` again, and stop: a slice is never built on a protected branch.

Done when you are on a work branch that is not protected, with no change in the working tree that this slice did not make.

### 3. Explore

Read the whole spec: the criteria the slice covers, the Boundaries, the Design, the seams in the Test strategy and the evidence it plans for each criterion, and the slices already done. Read the glossary and the ADRs the domain doc points to, and the code and tests the slice touches. Use the glossary's terms in test names and code.

Keep to the Boundaries throughout: do what **Always** says on every step, stop and ask the user before anything under **Ask first**, and leave alone what **Never** names.

Before writing code, check that the slice can be built as the spec states it. When a criterion contradicts the Design, the code or another criterion, or the agreed seam cannot reach the behaviour, go to **When the spec is wrong**.

Done when you know the seams the slice is tested at, the files it changes, and that nothing in the spec contradicts it.

### 4. Build test-first

Call the Skill tool with "aw-tdd" and build the slice through its red-green loop, one behaviour at a time. The seams in the spec's Test strategy are the pre-agreed seams `aw-tdd` asks for: the user agreed them in `/aw-slices`, so do not ask again. A test at any other seam needs the user's agreement first; when they agree, the Test strategy needs updating, which is a spec change to report in step 8, not to make.

- Name each test so that it mentions the `AC-n` it proves, such as `AC-2: a wrong password shows an error`: at `implemented`, `aw-check-spec` checks that each `test:` file mentions its criterion.
- When you are unsure how an API, framework or library behaves, call the Skill tool with "aw-source-driven-development" and ground the code in its official documentation before writing it.
- Run `run-check fast` as you go.
- Build only what the slice's criteria need. Behaviour that belongs to a later slice waits for it.

A criterion the Test strategy already plans to prove by `verify:` or `manual:` evidence gets no test: its evidence was agreed.

**Test exception.** When a test at the agreed seam would cost far more than it is worth, such as a real browser, device or third-party account the suite cannot drive, or a timing the suite cannot control, do not force it. Record a test exception instead, as the last item of the slice:

```markdown
   - Test exception: AC-2. <why a test at the agreed seam would cost too much>; proven by `verify:` evidence instead.
```

Then point the criterion's Traceability row at the verify evidence it relies on (step 6), so that `/aw-verify` proves it on the real app. Test whatever else in the slice is cheap to test. A test exception covers one criterion; when a criterion is still tested in part, keep its `test:` entry beside the `verify:` one.

Done when every behaviour of the slice's criteria has a passing test at an agreed seam, planned `verify:` or `manual:` evidence, or a recorded test exception.

### 5. Run the `task` checks

Run `run-check task`, filling `<files>` with the test files the slice added or changed. When the checks adapter has no `task` command, propose one from the project's manifest and run it. Report the level as passed only when you ran it in this session and it exited 0.

When it fails, fix what this slice broke and run it again. When it fails on something the slice did not touch, stop and report the failure with its output: commit nothing until the user decides.

Done when `run-check task` passed in this session.

### 6. Record the slice in the spec

Edit the spec, and nothing else in it:

- **Tick the slice:** change its done marker from `[ ]` to `[x]`.
- **Test exceptions:** the `Test exception:` items step 4 recorded, in this slice.
- **Traceability:** for each criterion the slice covers, set its row to the evidence where it landed: `` test: `<path>` `` for each test file that proves it, and `` verify: `docs/specs/<slug>/verify/` `` for a criterion with a test exception, unless the row already names a verify path. Keep the entries earlier slices recorded, separated by `;`, and replace only planned entries this slice made untrue.

Leave the frontmatter, the criteria, every other slice and every other section as they are. Then run `aw-check-spec` again. Fix a finding your edits caused; any other finding on this spec is a spec change: report it, and commit nothing.

Done when the slice is ticked, Traceability names the slice's evidence, and the check reports no finding on this spec, or ran by reading only and you said so.

### 7. Commit locally

Use `commit` for the slice's code, tests and spec edits, together, with a message in the VCS adapter's commit convention that names the slice, such as `feat: <slice name> (AC-1, AC-3)`. Stage only the paths this slice changed.

Never pass `--no-verify`. When a commit hook fails, fix what it reports, run `run-check task` again when the fix touched code, and commit again. When `commit` is at `draft`, write the exact command and message to the draft and tell the user the path.

Do not `push`, `open-review` or start a review of any kind: the commit stays local.

Done when the slice is in one local commit on the work branch, or in a draft whose path you gave the user.

### 8. Report

Report in chat:

- the spec's path and the slice built: name, criteria, AFK or HITL;
- the work branch and the commit's hash and subject, or the draft path;
- the tests added, one line each, with the criteria they prove;
- each test exception, with its reason, or "no test exceptions";
- the `run-check task` result, and the `aw-check-spec` result;
- any spec change step 4 or 6 found, for the user to make with `/aw-spec`.

Then name the next skill: `/aw-build` again for the next slice whose blockers are all done, or `/aw-verify` when every slice is done. Tell the user to run it; this skill never runs it, and never starts `/aw-review`.

## When the spec is wrong

When building shows that the spec is wrong (a criterion cannot be built as stated, contradicts the Design or the code, or needs behaviour the spec rules out), stop at once:

1. Commit nothing, and write no more code. Leave any uncommitted work as it is, and list its files for the user, who decides whether to keep or discard it.
2. Do not edit the spec: changing it is `/aw-spec`'s, which sets it back to `draft` and asks for approval again.
3. Propose the spec change: the section and the text as it stands, the text you propose, and the evidence that the spec is wrong, such as a failing test's output or the code that contradicts it.

Tell the user to make the change with `/aw-spec`, then to run `/aw-slices` when the change alters the slice plan, and `/aw-build` again after that. Done when the user has the proposed change and no commit was made.
