---
status: draft
ticket: "<ticket key or URL; delete this line when there is no ticket>"
---

# <Title of the change>

## Problem and goal

<Who is affected, what goes wrong today, and what is true once this change ships.>

## Acceptance criteria

- **AC-1**: Given <a starting state>, when <an action>, then <an observable result>.

## Out of scope

- <Behaviour this change leaves alone, so nobody builds it by accident.>

## Boundaries

### Always

- <What the agent does on every step of this change, such as running the `task` checks before each commit.>

### Ask first

- <What the agent stops and asks about, such as a new dependency or a schema change.>

### Never

- <What the agent leaves untouched, such as secrets or another team's module.>

## Design

<The approach: modules touched, interfaces, data, and the decisions behind them.>

## Slice plan

1. <Slice name> (AC-1). AFK or HITL.

## Test strategy

<The agreed test seams, what each one catches, and any criterion proven by verify or manual evidence instead of a test, with the reason.>

## Traceability

| AC | Evidence |
| --- | --- |
| AC-1 | test: `<path/to/test-file>` |

## Open questions

- BLOCKS: <A question that must be answered before approval. Once it is answered, record the answer in the spec and change the prefix to RESOLVED:.>
