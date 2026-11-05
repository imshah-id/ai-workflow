# ai-workflow

A personal, tracker- and VCS-agnostic kit of agent skills in `SKILL.md` format, published as a public repo. This glossary fixes the vocabulary the kit's skills, ADRs and docs use.

## Language

### The kit

**Harness**:
The coding agent that loads and runs skills, such as Claude Code, Codex or OpenCode.
_Avoid_: tool, agent, IDE, client

**Reference harness**:
The one harness the kit is tested on: Claude Code. Every other harness is supported only through the `SKILL.md` standard.
_Avoid_: primary tool, main agent

**Kit skill**:
A skill written or adapted for this kit, as opposed to a copy. Every skill in the kit, copies included, carries the `aw-` prefix.
_Avoid_: own skill, workflow skill

**Upstream**:
A third-party skill collection the kit copies from or draws on, pinned to a commit.
_Avoid_: source, origin, vendor

**Copy**:
An upstream skill shipped with its text unchanged except for the mechanical transform, with the upstream license inside its folder.
_Avoid_: vendored skill, fork, mirror

**Mechanical transform**:
The only edits a copy may carry. The first renames it with the `aw-` prefix. The second moves the shared upstream files it points to into its own folder and rewrites the paths to them.
_Avoid_: patch, local edit

**Adaptation**:
A kit skill whose text derives from one or more upstream skills.
_Avoid_: port, fork, merge

**Inspired skill**:
A kit skill that takes an idea from an upstream and none of its text.
_Avoid_: derivative

### Configuration

**Adapter**:
A per-repo file that translates canonical operations into one repo's actual tooling: `tracker.md`, `vcs.md` or `checks.md`.
_Avoid_: config, driver, integration

**Canonical operation**:
One of the named, tool-independent actions a kit skill may request, such as `fetch-ticket`, `push` or `run-check`.
_Avoid_: command, action, verb

**Access level**:
Whether the agent performs a write operation itself (`write`) or leaves a draft for a person (`draft`).
_Avoid_: permission, mode, read-only

**Default access**:
The access level a tracker or VCS adapter declares for its write operations as a whole. Each row of its Operations table still states its own effective level.
_Avoid_: global level, base access, fallback

**Override**:
A write operation whose effective access level in an adapter's Operations table differs from that adapter's Default access.
_Avoid_: exception, per-operation setting, custom level

**Draft**:
The exact text or command of an operation the agent may not perform, left for a person to apply.
_Avoid_: proposal, suggestion, pending change

**Check level**:
One of three named scopes of automated checks: `fast`, `task` and `full`.
_Avoid_: check tier, test suite, gate

### Work and its record

**Tracker**:
Wherever a repo keeps its tickets: none, local markdown, or an external service.
_Avoid_: issue tracker, backlog, board

**Ticket**:
A transient unit of work that lives in the tracker. It may link to a spec, but it never holds one.
_Avoid_: issue, task, story, work item

**Spec**:
A durable document in the repo that states the intended behaviour of one change. It outlives the merge and is updated in the same change that alters the behaviour.
_Avoid_: PRD, plan, design doc, ticket

**Acceptance criterion**:
A numbered, verifiable statement in a spec, written `AC-n`.
_Avoid_: requirement, user story, AC (alone, without a number)

**Evidence**:
The proof attached to an acceptance criterion: a test, a verify journey, or a manual check with its reason.
_Avoid_: proof, coverage, validation

**Traceability**:
The section of a spec that maps every acceptance criterion to its evidence.
_Avoid_: coverage matrix, test plan

**Slice**:
A vertical piece of a spec that can be built and verified on its own and covers at least one acceptance criterion. Slices are listed in the spec's slice plan.
_Avoid_: task, step, subtask, ticket

**Tracer bullet**:
The shape every slice takes: a narrow but complete path through every layer the change touches (data, logic, interface, tests), never one layer on its own.
_Avoid_: spike, walking skeleton, end-to-end slice

**AFK**:
The mark on a slice that an agent can build and verify with no person involved.
_Avoid_: autonomous, unattended, agent-only

**HITL**:
The mark on a slice that needs a person during the slice: a judgement on a design or UI, credentials or an account only they have, or a check only they can make.
_Avoid_: manual slice, attended, human task

**Expand–contract**:
The sequence for a wide refactor, one mechanical change whose blast radius fans out so far that no vertical slice of it can land green. Expand adds the new form beside the old; migrate moves the callers over in batches, each its own slice; contract removes the old form once no caller is left.
_Avoid_: parallel change, phased migration, big-bang refactor

**Mirror ticket**:
A ticket published from a slice so that the tracker can follow it. The slice stays the source of truth.
_Avoid_: sub-issue, child ticket

### The workflow

**Phase**:
A stage of the workflow, owned by exactly one kit skill and producing exactly one artifact.
_Avoid_: step, stage

**Route**:
The path a task takes through the phases, chosen at intake: fast, standard or epic.
_Avoid_: track, lane, mode, flow

**Pre-step**:
The action intake runs according to the task's type before any change: reproduce a bug, add characterization tests before a refactor, measure a performance baseline.
_Avoid_: prerequisite, setup step

**Human gate**:
A point where the work continues only after a person explicitly decides it should. The kit has one fixed gate: spec approval.
_Avoid_: checkpoint, approval step, sign-off

**Spec approval**:
The human gate where a person accepts a draft spec and its status becomes `approved`.
_Avoid_: sign-off, spec review

**Verify skill**:
A skill generated inside one repo that starts, drives and observes that repo's real app to gather evidence.
_Avoid_: e2e skill, test harness
