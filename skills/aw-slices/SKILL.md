---
name: aw-slices
description: "Write an approved spec's slice plan and Test strategy: vertical tracer-bullet slices covering every AC-n, riskiest first with blocking edges, test seams agreed with the user, and mirror tickets where the tracker allows. Run after spec approval in /aw-spec."
disable-model-invocation: true
---

# Slices

Turn an approved spec into its **slice plan**: the vertical slices `/aw-build` builds one per call, in an order that surfaces problems early. Agree the test seams with the user and record them in the spec's **Test strategy**. When the tracker allows it, publish each slice as a **mirror ticket**. The slice plan in the spec stays the source of truth: a mirror ticket only lets the tracker follow it.

This skill writes only the spec's Slice plan and Test strategy, and the planned evidence in Traceability when an agreed seam moves it. Anything else the spec needs is a spec change, made through `/aw-spec`.

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

## Steps

### 1. Take the approved spec

Take the spec the user names, or the one `/aw-spec` approved in this conversation. When neither is clear, list the specs under `docs/specs/` with their `status` and ask which one.

Read its frontmatter. **Refuse to go on unless `status` is `approved`**, and say why:

- `draft`: the spec has not passed spec approval. Tell the user to finish it with `/aw-spec` and approve it there.
- `implemented`: the spec is built. To change it, run `/aw-spec`, which sets it back to `draft` for the change and asks for approval again.
- `superseded`: name the spec its `superseded-by` points to.

Never set or change `status` yourself. Then call the Skill tool with "aw-check-spec" and run it on the repo. When it reports a finding on this spec, stop: report the findings and tell the user to fix them with `/aw-spec`. When it reports `Result: not script-verified`, Node is missing: say so, and go on.

Done when the spec is at `approved` and the check reports no finding on it.

### 2. Explore

Read the whole spec: its acceptance criteria, Boundaries, Design, the seams its Test strategy proposes, and the Slice plan when one is already written, which is your starting point on a re-run. Read the glossary and the ADRs the domain doc points to, and the code the Design touches, with its tests. Use the glossary's terms in slice names.

Look for prefactoring that makes the change easy: a move, rename or extraction that changes no behaviour and makes the slices that follow it simpler.

Done when you know the modules each criterion touches, the riskiest part of the Design, and any prefactoring worth a slice.

### 3. Draft the slices

Break the spec into **slices**. Each slice:

- is a **tracer bullet**: a narrow but complete path through every layer the change touches (data, logic, interface, tests), never one layer on its own;
- covers at least one `AC-n`, and is built and verified on its own: when it is done, the criteria it covers can be proven;
- fits in one `/aw-build` call, in one fresh context;
- is marked **AFK** when an agent can build and verify it with no person involved, or **HITL** when a person is needed during the slice: a judgement on a design or UI, credentials or an account only they have, or a check only they can make.

Give each slice its **blocking edges**: the slices that must be done before it can start. A slice with no blockers can start at once.

Order the plan so that every slice comes after its blockers and, among the rest, **riskiest first**: the slice whose failure would most change the plan goes early, such as an unfamiliar API, a contract or data change, a performance assumption, or the integration every later slice rests on. Prefactoring goes first and blocks the slices it eases.

**Wide refactors** are the exception to vertical slicing. A wide refactor is one mechanical change, such as renaming a column or retyping a shared symbol, whose blast radius fans out so far that no vertical slice of it can land green. Sequence it as **expand–contract**:

1. **Expand**: add the new form beside the old, so nothing breaks.
2. **Migrate**: move the callers over in batches sized by blast radius (per package, per directory), each batch its own slice blocked by the expand, each one green because the old form still exists.
3. **Contract**: remove the old form once no caller is left, in a slice blocked by every migrate batch.

Each of these slices still covers the criteria it makes provable; one that makes none provable folds into the slice that does.

Done when every slice has a name, its criteria, AFK or HITL, and its blockers.

### 4. Check coverage, both ways

Compare the slices with the spec's acceptance criteria and report every gap:

- a **slice that covers no criterion**: say so, then fold it into a slice that does, or drop it;
- a **criterion no slice covers**: say so, then add a slice or extend one to cover it;
- a slice that names an `AC-n` the spec does not define: say so, and fix the slice.

When a gap can only be closed by changing the criteria, because a slice the Design needs proves nothing a criterion states, or a criterion cannot be built as stated, stop: the spec is wrong. Tell the user, propose the change, and tell them to make it with `/aw-spec`.

Done when every slice covers at least one defined criterion, every criterion is covered by at least one slice, and each gap you found has been reported to the user.

### 5. Agree the plan and the seams

Show the user the plan as a numbered list. For each slice: its name, the criteria it covers, AFK or HITL, its blockers, and what it delivers end to end. Add the coverage report from step 4, even when it found no gap.

Then propose the **test seams**, starting from those the spec's Test strategy proposes: prefer the seams the repo already has, and the highest one that reaches the behaviour. For each seam, give one line on what it catches and one on what it misses, and the criteria it proves. Name each criterion to be proven by `verify:` or `manual:` evidence instead of a test, with the reason.

Ask the user:

- whether the slices are the right size, or should be split or merged;
- whether each blocking edge is real, and the order puts the riskiest work first;
- whether they agree each seam, and each criterion left to `verify:` or `manual:` evidence.

Iterate until the user agrees the plan and every seam. A seam the user has not agreed is not written down. When the user's changes alter coverage, run step 4 again.

Done when the user has agreed the plan and the seams in this conversation.

### 6. Write them into the spec

Replace the Slice plan section with the agreed slices, in order, in this shape:

```markdown
1. <Slice name> (AC-1, AC-3). AFK.
   - Delivers: <the end-to-end behaviour this slice makes work>
   - Blocked by: none.
2. <Slice name> (AC-2). HITL.
   - Delivers: <…>
   - Blocked by: 1.
```

Replace the Test strategy section with the agreed seams: for each one, what it is, what it catches, what it misses and the criteria it proves; then each criterion proven by `verify:` or `manual:` evidence, with its reason.

When an agreed seam changes where a criterion's evidence will live, update that row's planned evidence in Traceability. Change nothing else: not the frontmatter, not the criteria, not the Design. The spec stays at `approved`, since the slice plan and Test strategy are this skill's to write after spec approval.

Run `aw-check-spec` again, and fix every finding on this spec's Slice plan, Test strategy and Traceability. A finding anywhere else is a spec change: report it, and tell the user to make it with `/aw-spec`.

Done when the spec holds the agreed plan and seams, and the check reports no finding on it, or ran by reading only and you said so.

### 7. Mirror the slices in the tracker

Mirror tickets depend on the tracker adapter:

- **Tracker `none`**, configured or by default: skip them. Write no draft, and tell the user "no tracker: mirror tickets skipped; the slice plan is the record".
- **`publish-ticket` at `write`**: publish one mirror ticket per slice that has none yet, in plan order, so that each blocker has a key before the slices it blocks. Then add each blocking edge with `link-tickets` (the blocked ticket is blocked by its blocker's ticket), and, when the spec has a `ticket:`, link each mirror ticket as part of it. Do each `link-tickets` at its own access level: at `draft`, write the links, with their real keys, to one draft.
- **`publish-ticket` at `draft`**: publish nothing. Write every mirror ticket, in plan order, to one draft, `.aw/drafts/<yyyymmdd-hhmmss>-publish-ticket.md`, and every link to `.aw/drafts/<yyyymmdd-hhmmss>-link-tickets.md`, naming a ticket that does not exist yet as `<key of slice n>`. Tell the user both paths and the order to apply them in.

Each mirror ticket has the slice's name as its title, and this body:

```markdown
Mirror of slice <n> in `docs/specs/<slug>/spec.md`. The spec is the source of truth: where this ticket and the slice differ, the slice wins.

**Delivers:** <the slice's Delivers line>
**Covers:** <each AC-n with its text, copied from the spec>
**Mode:** <AFK or HITL>
**Blocked by:** <the blockers' ticket keys, or "none">
```

Record each published ticket's key in its slice, as a last item `- Mirror: <key>`. On a re-run, a slice that already has a `Mirror:` line is not published again; when the slice changed, `comment-ticket` its mirror ticket with the change, and when a slice is dropped, `comment-ticket` its mirror ticket to say so. Never close or edit a ticket the spec does not mirror, the spec's own `ticket:` included.

Done when every slice has its mirror ticket published and recorded, or drafted, or the tracker is `none` and you said they were skipped.

### 8. Report

Report in chat:

- the spec's path, and the slices in order, one line each: name, criteria, AFK or HITL, blockers;
- the coverage report: each gap found and how it was closed, or "no gaps";
- the agreed seams, one line each;
- the mirror tickets: their keys, the draft paths, or "skipped: no tracker";
- the `aw-check-spec` result.

Then name the next skill: `/aw-build`, to build the first slice whose blockers are all done. Tell the user to run it; this skill never runs it.

## Credits

Tracer-bullet slicing, blocking edges, expand–contract for wide refactors, quizzing the user on the breakdown and publishing blockers first adapt Matt Pocock's `to-tickets` (MIT), as listed in the kit's `NOTICE.md`.
