# The spec always lives in the repo, never in the tracker

A spec is always a file in the repo (`docs/specs/<slug>/spec.md`): a living document with numbered acceptance criteria (`AC-n`) and a Traceability section, versioned with the code it describes. The tracker holds only tickets, which may link to the spec. Spec location is not configurable, so there is no `docs/agents/specs.md`.

## Considered Options

- **Configurable, repo or tracker** (the initial draft): rejected. Every skill that reads a spec (`aw-build`, `aw-review`, `aw-ship`, the spec check) would need two code paths, and Traceability can only be checked mechanically when it is a file next to the tests it points at.
- **Tracker only** (Matt Pocock's `to-spec`): rejected for the same reason, and because it leaves repos with no tracker without a spec.

## Consequences

- The local-markdown tracker must keep tickets apart from specs. Pocock's layout puts both under `.scratch/<slug>/`; the kit's does not.
- A spec's folder is always named by slug, never by ticket key, because a repo with no tracker has no keys. The spec records its ticket in an optional `ticket:` frontmatter field. It is a folder rather than a single file so that verification artifacts can sit next to the spec.
