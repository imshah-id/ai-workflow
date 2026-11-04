# Three routes; spec approval is the only fixed human gate

`aw-intake` sends every task down one of three routes. When in doubt, it picks the longer one.

| Route | When | Phases |
| --- | --- | --- |
| Fast | Fits in one session; no change to contracts, data or security | `aw-intake` (states 1 to 3 "done when" criteria), pre-step, `aw-build` with no spec, `aw-review`, `aw-ship`. `aw-verify` runs only if a verify skill exists |
| Standard | Everything else | `aw-intake`, `aw-spec`, **spec approval**, `aw-slices`, `aw-build` once per slice, `aw-verify`, `aw-review`, `aw-ship`, and optionally `aw-retro` |
| Epic | Several sessions or deliverables | `aw-intake`, `aw-wayfinder`, then the standard route for each deliverable, with its own spec |

**Spec approval** is the one fixed human gate. It is what makes writing the spec first worth it, because it catches a misunderstanding before it costs code. It stays light: the person approves explicitly in the conversation, and only then does the agent set `status: approved`. The fast route has no spec, so it has no gate.

Accepting the change is not a fixed gate. `merge` is a canonical VCS operation at `draft` by default, so a person merges. With `merge: write`, `aw-ship` merges only when `aw-review` found no proven defect and `run-check full` passed; with no review host, it merges locally into the base branch. `aw-ship` runs `run-check full` itself.

## Considered Options

- **Two fixed gates: spec approval and human PR review**: rejected. Mandatory human PR review came from an earlier corporate setting where every PR was reviewed by hand. A personal kit should allow autonomy once the spec is approved and the evidence is in.
- **No gates at all**, with spec approval implied once grilling ends: rejected for the reason above.
