# Every skill in the kit carries the `aw-` prefix, copies included

Every skill the kit ships is named `aw-<name>`: kit skills (`aw-spec`, `aw-build`, ...) and copies (`aw-grilling`, `aw-tdd`, ...). The kit has to sit next to Matt Pocock's plugin and other kits, and be enabled only in the repos that use the workflow. Unprefixed names (`grilling`, `review`, `ship`) would collide in un-namespaced installs such as `npx skills`, would make a bare `/grilling` ambiguous, and would let one kit's skill run by accident in place of the other's.

## Considered Options

- **No prefix, rely on the plugin namespace** (Pocock's choice, see his `.out-of-scope/harness-name-collisions.md`): rejected. `npx skills` installs into a flat directory, and Claude Code's docs do not say which skill a bare name resolves to when two plugins ship it.
- **Prefix only kit skills; copies keep upstream names**: rejected. It keeps copies byte-identical to upstream, but leaves exactly the accidental collisions this ADR exists to prevent.

## Consequences

- A copy is no longer byte-identical to its upstream. Its text is unchanged except for a mechanical rename: the folder, the `name:` field, and references to other copied skills (for example `aw-tdd` calls the Skill tool with `aw-codebase-design`). The sync tooling applies the rename and checks that the upstream text plus the rename equals the copy.
- Per-repo choice also relies on Claude Code's `enabledPlugins`. The kit can be installed with `--scope project` only where it is used, and Pocock's plugin can be disabled in those repos.
