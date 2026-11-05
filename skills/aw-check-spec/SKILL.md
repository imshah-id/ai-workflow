---
name: aw-check-spec
description: Spec check for the specs under docs/specs/. Use after writing or editing a spec, before spec approval, and before setting a spec to implemented.
---

# Check spec

Mechanical validation of every spec at `docs/specs/<slug>/spec.md`. The script is the check; reading is only the fallback when Node is missing. A new spec starts from [`SPEC-TEMPLATE.md`](SPEC-TEMPLATE.md).

## Steps

1. **Find Node.** Run `node --version`. Node 18 or later counts as found. Done when you know whether it is found.
2. **Node found: run the script** from the repo root:

   ```sh
   node <this skill's folder>/scripts/check-spec.mjs [repo-root]
   ```

   `repo-root` defaults to the current directory. Each stdout line is one finding, `<path>: <message>`; stderr carries the summary.

   - Exit 0: report the stderr summary as it stands, either "<n> spec(s) valid" or "no specs found … nothing to check".
   - Exit 1: report every finding verbatim. The spec is not valid until a rerun exits 0.
   - Exit 2: the repo root is wrong. Rerun with the right one.

   Done when the script has exited and its result is reported.
3. **Node not found: walk the checklist by reading.** Start the report with the line `check-spec not run: Node not found`. Read each spec and apply every rule under **Rules**, reporting each violation as `<path>: <message>`. End the report with `Result: not script-verified`, even when the walk found no violation: only the script can pass a spec. Done when every rule has been applied to every spec.

## Rules

The script and the fallback walk apply the same rules. Specs may use LF or CRLF line endings. Headings and list items inside fenced code blocks do not count.

**Specs.** Each folder under `docs/specs/` holds a `spec.md` file. A Markdown file directly in `docs/specs/`, other than a README, is a misplaced spec. A repo with neither has nothing to check, which is not an error.

**Frontmatter.** The spec opens with a `---` block holding only these fields:

- `status`: `draft`, `approved`, `implemented` or `superseded`.
- `ticket`: optional, the tracker key or URL.
- `superseded-by`: the slug of the replacing spec, required when `status` is `superseded` and allowed only then. `docs/specs/<that slug>/spec.md` exists.

**Sections.** Each of these is a `## ` heading: Problem and goal, Acceptance criteria, Out of scope, Boundaries, Design, Slice plan, Test strategy, Traceability, Open questions. Boundaries holds three `### ` tiers: Always, Ask first, Never.

**Slice plan.** No rule applies to its content. Each slice opens with a done marker, `[ ]` until it is built and `[x]` once it is, and may carry `Delivers:`, `Blocked by:`, `Mirror:` and `Test exception:` items; none of these is a finding.

**Acceptance criteria.** Each criterion is a list item or heading that starts with its id, `- **AC-n**: Given …, when …, then …`. The section defines at least one, and each `AC-n` once.

**Traceability.** A table whose first column is the `AC-n` and second its evidence. Every defined `AC-n` has a row, and every row's `AC-n` is defined. Several entries in one cell are separated by `;` or `<br>` before the next `test:`, `verify:` or `manual:`, so a reason may hold a `;`:

- `test: <path>`: a test file, relative to the repo root, with `/` or `\`.
- `verify: <path>`: a verify result file or folder, relative to the repo root.
- `manual: <reason>`: what was checked by hand and why no test or verify journey covers it.

**Open questions.** A list item starting with `BLOCKS:` is an open blocking question. Once answered, the answer goes into the spec and the prefix becomes `RESOLVED:`. At `approved` and `implemented`, no `BLOCKS:` item remains. A `superseded` spec is exempt, since it may have been superseded as a draft.

**Evidence at `implemented`.** Every row has at least one entry, and each entry resolves:

- every entry starts with `test:`, `verify:` or `manual:`;
- a `test:` file exists and mentions its `AC-n` (`AC-1` does not count as a mention of `AC-10`, or the reverse);
- a `verify:` path exists;
- a `manual:` entry carries a reason.
