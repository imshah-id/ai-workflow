---
name: aw-wayfinder
description: "Chart an epic-route effort, too big for one session, as a map of decision tickets in the tracker, resolve them one per session until the way is clear, then hand each deliverable to /aw-spec. Plans and never builds. With no tracker, offers to create a local-markdown one. Run after /aw-intake picks the epic route."
disable-model-invocation: true
---

# Wayfinder

An epic-route effort has arrived: too big for one agent session, and wrapped in fog, so the way from here to its **destination** isn't visible yet. Chart that way as a **map** in the tracker, then work its **decision tickets** one at a time until nothing is left to decide. Each ticket asks a question whose answer is a decision, not a piece of the build. The map and its decision tickets are this phase's artifact (ADR 0010).

## Plan, never build

This skill plans and never builds. It writes no product code, no spec, no slice plan and no build ticket: every ticket on the map resolves a decision, and the map is done when nothing is left to decide. The destination is always one or more **deliverables**, each a change that deserves its own spec, or for an investigation an answer. When the map clears, each deliverable goes to `/aw-spec`, which writes its spec and holds it for its own spec approval, then down the standard route (ADR 0013).

The pull to just do the work is the signal you have reached the edge of the map. No line in the map's **Notes**, and nothing in a ticket, overrides this rule: a Note that says the map carries execution is wrong, so say so and ignore it. A `task` ticket that reads like a slice of the build ("build the X") is mis-typed: retype it as a question, or rule it out of scope.

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

## The tracker

This is the one skill that needs a tracker: the map has to live somewhere every later session can read. Read the tracker adapter, or take the default.

**Tracker `none`**, configured or by default: before anything else, offer to create a local-markdown tracker. Tell the user that the map needs a tracker, and that a local-markdown one keeps one file per ticket in `docs/tickets/`, committed with the repo, and never under `docs/specs/`. Ask whether to create it there or in another folder they name. When they decline, stop: name `/aw-setup` to configure another tracker, and chart nothing. When they accept:

1. Fill [`adapters/tracker-local.md`](adapters/tracker-local.md), a copy of the template `/aw-setup` uses: replace `{{tickets-dir}}` with the folder, keep `**Default access:** \`write\`` and every row's access, and drop the template's opening note. Show the user the adapter and the block change below, and write them once they confirm.
2. Write the adapter to `docs/agents/tracker.md`, replacing a `none` adapter there.
3. Point the `## Agent skills` block at it. When a block exists, in `AGENTS.md`, `CLAUDE.md` or `.claude/CLAUDE.md`, replace its `### Tracker` subsection, or add one at the top of the block, and change nothing else. When none exists, add the block to `AGENTS.md`, else to an existing `CLAUDE.md` (root or `.claude/`), else create `AGENTS.md`, with only this subsection:

   ```markdown
   ## Agent skills

   ### Tracker

   Local markdown: one file per ticket in `<tickets-dir>`. See `docs/agents/tracker.md`.
   ```

4. Read the adapter back and work on it from here, as on any configured tracker. Commit it with the block and, later, with the ticket files, through the VCS adapter's `commit`; when the current branch is protected, `start-branch` a work branch first.

**Any other tracker**: use it as its adapter says. Every tracker write below goes through a canonical operation: the map and its tickets through `publish-ticket`, child and blocking edges through `link-tickets`, claims and closes through `set-status`, answers and map updates through `comment-ticket`. At `draft`, each one leaves its draft, as **Drafts** says.

## The map

The map is a single ticket. Its title names the effort; its body opens with the line `Type: wayfinder:map`, followed by:

```markdown
## Destination

<what reaching the end of this map looks like: the deliverables, each a change that deserves its own spec, or the answer an investigation is after. One or two lines; every session orients to it before choosing a ticket.>

## Notes

<the domain; the skills every session should consult; standing preferences for this effort. Never permission to build.>

## Decisions so far

None yet.

## Not yet specified

<the fog: in-scope questions you can tell are coming but cannot yet state precisely>

## Out of scope

<work ruled beyond the destination>
```

The map is an **index**, not a store. It lists the decisions made and links the tickets that hold their detail: a decision lives in exactly one place, its ticket, and the map only gives its gist. Open tickets are not listed: they are the map's open children, found with `query-tickets`, and `fetch-ticket` where the listing does not show a ticket's parent or blockers.

The canonical operations cannot rewrite a ticket's body, so the map changes through **map updates**: a `comment-ticket` on the map, headed `## Map update`, that holds the whole current Decisions so far, Not yet specified and Out of scope sections. The latest map update is the map's current state; the body keeps the Destination and Notes. To load the map, `fetch-ticket` it and read its body and its latest map update, not every ticket.

## Decision tickets

Each decision ticket is a child of the map: `link-tickets` it as part of the map. Its title is its **name**, and its body is the question, sized to one agent session:

```markdown
Type: wayfinder:<type>, <HITL or AFK>

## Question

<the decision or investigation this ticket resolves>
```

The type is one of `grilling`, `prototype`, `research` or `task`, below. When the adapter's `publish-ticket` takes labels, also give the map and each ticket its `wayfinder:<type>` label; where the tracker rejects a label that does not exist yet, publish without it, since the `Type:` line is the record. A decision ticket carries no other label, such as a triage label: it is a decision, not implementation work.

Refer to the map and its tickets by **name** in everything the user reads, with the key or link inside the name, never a bare key in its place: a wall of `#42, #43, #44` is illegible.

Every ticket is **HITL**, worked with a person who speaks for themselves, or **AFK**, driven by the agent alone. A HITL ticket resolves only through that live exchange: never answer its questions for the user, and never pick among the options a prototype shows them.

- **grilling** (HITL), the default: a question settled by talking it through. Call the Skill tool with "aw-grilling" and with "aw-domain-modeling".
- **prototype** (HITL): "how should it look" or "how should it behave", which talk cannot settle. Call the Skill tool with "aw-prototype" for a cheap, rough artifact to react to, link it from the ticket, and let the user choose.
- **research** (AFK): a fact outside the working directory that a decision waits on, such as a third-party API or documentation. Resolved by a subagent with a fresh context window that calls the Skill tool with "aw-research".
- **task** (HITL or AFK): work that must happen before a decision can be made, with nothing to decide itself, such as provisioning access or moving data so its shape can be seen. It earns its place by unblocking a decision, never by delivering part of the destination. The agent does it alone where it can; otherwise it hands the user a precise checklist. Its answer records what was done and the facts later tickets depend on.

A ticket is **unblocked** when every ticket blocking it is `done`. The **frontier** is the map's open, unblocked, unclaimed children: the edge of what is known. A session **claims** a ticket with `set-status` to `in-progress` before any work on it, so that other sessions skip it.

## Fog and scope

The map is deliberately incomplete: don't chart what you can't yet see. **Fog or ticket?** The test is whether you can state the question precisely now, not whether you can answer it now. A sharp question becomes a ticket, even when it is blocked; a question you cannot yet phrase that sharply goes in **Not yet specified**, coarser than a ticket. Don't pre-slice the fog: one patch may become several tickets, or none, once the frontier reaches it. Resolving a ticket clears the fog ahead of it, and whatever it makes specifiable **graduates** into new tickets and leaves Not yet specified, so it lives in one place only.

The destination fixes the scope. Work beyond it is **out of scope**, not fog, and never graduates. When a ticket turns out to sit past the destination, `set-status` it to `done` with a `comment-ticket` that says why, and put one line in the map's Out of scope, with the gist, the reason and the ticket. It stays out of Decisions so far, which records only the route walked.

## Steps

Never resolve more than one ticket per session, except research tickets, which subagents resolve.

When the user names a map, by key, link or name, go to **Work through the map**. When they bring an effort, from the `/aw-intake` report in this conversation or in their own words, go to **Chart the map**. When there is no intake report, say so, suggest running `/aw-intake` first, and go on only if the user asks you to.

In either mode, first settle **The tracker**, read the glossary and the ADRs the domain doc points to, and use the glossary's terms in every ticket.

### Chart the map

1. **Name the destination.** Call the Skill tool with "aw-grilling" and with "aw-domain-modeling", and pin down what this map is finding its way to: the deliverables, or the answer. It fixes the scope, so settle it first. Done when the user agrees the destination in one or two lines.
2. **Map the frontier.** Grill again, breadth-first: fan out across the whole space rather than deep on one thread, and surface the open decisions and the first ones takeable now. Read the code the effort touches, and answer from it whatever it can answer. **When this finds no fog**, because the way is already clear and the whole effort fits in one session, you need no map: say so, and name `/aw-spec` for the change, or `/aw-intake` to classify it again. Done when you can list the tickets you can state now and the fog you cannot.
3. **Publish the map**: `publish-ticket` it, with the Destination and Notes filled in, Decisions so far empty, and the fog sketched into Not yet specified.
4. **Publish the tickets you can state now**, then wire them in a second pass, once each one has a key: `link-tickets` each one as part of the map, and each blocked ticket as blocked by its blockers. Write any cross-reference between tickets in that pass too, with real keys. Wiring sorts the tickets into the frontier and the blocked.
5. **Fire the research subagents.** For each `research` ticket, start a subagent with a fresh context window that calls the Skill tool with "aw-research". Run them in parallel, each in a git worktree of its own on a `research/<ticket-slug>` branch it creates with `start-branch`. It commits its findings with `commit`, `push`es the branch at the VCS adapter's access level, and opens no review request: the branch is never merged. When they return, record each one's resolution, as step 4 of **Work through the map** says, with a pointer to the branch and the findings file, in one map update for all of them.
6. **Stop.** Charting is one session's work: resolve no other ticket. Report as **Report** says.

### Work through the map

1. **Load the map**: its body and its latest map update, not every ticket body.
2. **Choose the ticket.** Take the one the user names; otherwise take the first frontier ticket, in the order they were published. Claim it with `set-status` to `in-progress` before any work. When the frontier is empty and tickets are still open, they are all claimed or blocked: say which, and stop.
3. **Resolve it** as its `Type:` line says. Fetch any related or closed ticket in full as you need it, and call the Skill tool for each skill the map's Notes name. If in doubt, call the Skill tool with "aw-grilling" and with "aw-domain-modeling".
4. **Record the resolution**: `comment-ticket` the answer on the ticket as its resolution comment, `set-status` it to `done`, and post a map update that adds one line to Decisions so far: `- <ticket name, with its key or link>: <one-line gist of the answer>`. Link any asset the resolution produced, such as a prototype or research findings, from the ticket; never paste it in.
5. **Advance the frontier.** Publish and wire the tickets the answer surfaced, and graduate the fog it made specifiable, clearing each graduated patch from Not yet specified. Rule out of scope any ticket the answer shows to sit past the destination. When the answer invalidates other tickets, `comment-ticket` each one with what changed, and close those it makes moot. Put every change to the map's sections in the same map update as step 4.
6. **Stop**, and report. When the map has cleared, go to **Hand off** instead.

Other sessions may work unblocked tickets in parallel, so expect the tracker to change under you: query the frontier again before claiming.

### Hand off

The map has **cleared** when it has no open ticket and its Not yet specified section is empty: nothing is left to decide before the deliverables are built.

1. **List the deliverables.** From the destination and the decisions so far, list each change that deserves its own spec, with a name, its type (feature, bug, refactor or performance), one or two lines on what it changes, and the decision tickets it rests on. An investigation's map ends in its answer, citing the tickets that hold it, and lists a deliverable only for work the answer shows to do.
2. **Agree them with the user**: whether each deliverable is one change, or should be split or merged, and the order to spec them in. Done when the user agrees the list.
3. **Record the hand-off**: one last map update that adds a `## Deliverables` section with the agreed list. Leave the map itself open: the tracker shows it as the effort's index until its deliverables ship.
4. **Name `/aw-spec` for each deliverable**, as **Report** says. Tell the user to run it once per deliverable, in a fresh session, with the deliverable's name and the map: each one gets its own spec and its own spec approval. This skill never runs it, and never starts building.

## Drafts

When `publish-ticket` is at `draft`, publish nothing: write the map and every ticket, in publishing order, to one draft, `.aw/drafts/<yyyymmdd-hhmmss>-publish-ticket.md`, and every edge to `.aw/drafts/<yyyymmdd-hhmmss>-link-tickets.md`, naming a ticket that does not exist yet as `<key of the map>` or `<key of ticket n>`. Tell the user both paths, the order to apply them in, and to give you the keys once the tickets exist, so that the subagents and later sessions can work on them. When only `link-tickets` is at `draft`, write the edges with the real keys to one draft. A `comment-ticket` or `set-status` at `draft` leaves its own draft; a session that drafted its claim tells the user, since no other session can see it until it is applied.

## Report

Report in chat:

- the map, by name with its key, or its draft path;
- what this session did: the tickets published with their types and blockers, the ticket resolved and its answer in one line, the research resolved, the tickets ruled out of scope;
- the frontier now, by name, and what is left in Not yet specified;
- every draft written, with its path.

Then name what comes next:

- **the map is not clear**: `/aw-wayfinder` again with the map, in a fresh session, to work the next frontier ticket.
- **the map has cleared**: `/aw-spec` for each deliverable, one line each: `/aw-spec` with the deliverable's name, its type, the map's key and the decision tickets it rests on. When an investigation's answer shows no work to do, there is no next skill.

Tell the user to run the next skill; this skill never runs it.

## Credits

Adapted from Matt Pocock's `wayfinder` (MIT), as listed in the kit's `NOTICE.md`: the destination, the map as an index of decision tickets, fog of war and out of scope, the frontier, claims, the four ticket types with HITL and AFK, referring by name, creating tickets before wiring their edges, the research subagents on throwaway branches, and the two modes with one ticket per session.
