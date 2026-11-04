# Research: addyosmani/agent-skills

- Upstream: https://github.com/addyosmani/agent-skills
- Default branch: `main`
- Latest commit on `main`: `301b02b12bff98e4688e6984af6556802322bbde`, committed 2026-11-01T19:24:49Z ("Merge #736: validate review findings against code and baseline"). Tag `0.6.15` plus 2 commits.
- Candidate pin `301b02bbde…`: **does not resolve.** No full SHA was found (see section 5).
- Recommended pin: `301b02b12bff98e4688e6984af6556802322bbde` (the latest commit). **This is not the candidate as given**, because the candidate could not be resolved. All permalinks below point at this commit.
- Ticket: [#2](https://github.com/samfaina/ai-workflow/issues/2)
- Date researched: 2026-11-04
- Sources: upstream repo only (GitHub REST API via `gh api`, plus a blobless clone of the repo for reading files and running `git grep`. No scripts were run.)

Permalink base: `https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/`

## 1. License

**Answer:** MIT, "Copyright (c) 2025 Addy Osmani". There is one license file, at the repo root. It covers the whole repo, including the skill folders. No folder has its own LICENSE and no exceptions are stated.

Full text of [`LICENSE`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/LICENSE#L1-L21) (21 lines):

```text
MIT License

Copyright (c) 2025 Addy Osmani

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Copyright holder line: `Copyright (c) 2025 Addy Osmani` ([L3](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/LICENSE#L3)).

Coverage evidence:

- `git ls-files | grep -i licen` at the pin returns only `LICENSE`. No `skills/<name>/` folder has a LICENSE file.
- No `SKILL.md` has a `license:` frontmatter key (`git grep -n '^license:' -- skills` returns nothing). The three files checked in section 2 carry only `name` and `description`.
- The GitHub API reports the repo license as `MIT` (`spdx_id: MIT`).
- README license section, [`README.md#L408-L410`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/README.md#L408-L410):

  > ## License
  >
  > MIT - use these skills in your projects, teams, and tools.

- [`CONTRIBUTING.md#L135-L137`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/CONTRIBUTING.md#L135-L137):

  > ## License
  >
  > By contributing, you agree that your contributions will be licensed under the MIT License.

- The plugin manifests also declare `"license": "MIT"`: [`.claude-plugin/plugin.json#L10`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/.claude-plugin/plugin.json#L10), [`plugin.json#L9`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/plugin.json#L9), [`.codex-plugin/plugin.json#L11`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/.codex-plugin/plugin.json#L11), [`.claude-plugin/marketplace.json#L19`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/.claude-plugin/marketplace.json#L19).

The LICENSE file was last changed in commit `3e4a665` (2026-02-15).

## 2. Copies

**Answer:** All three exist at the recommended pin, which is also latest:

- `skills/source-driven-development/`
- `skills/security-and-hardening/`
- `references/security-checklist.md`, at the repo root and not inside any skill

At the candidate pin they are **Unconfirmed**, because that SHA does not resolve. `source-driven-development` points outside its folder only by naming another skill. `security-and-hardening` points to the repo-root checklist through `../` paths in six places and names two other skills. The checklist names one skill.

Folder contents at the pin (from `git/trees/<sha>?recursive=1`, which matches the clone's blob SHAs):

| Path | Blob SHA |
|---|---|
| [`skills/source-driven-development/SKILL.md`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/source-driven-development/SKILL.md) (217 lines; the only file in the folder) | `fb94d0f36e2d4c53e6b507dd763d105b2e958623` |
| [`skills/security-and-hardening/SKILL.md`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/security-and-hardening/SKILL.md) (216 lines) | `fc85325b50e72b935f2916dd74af12c650e9c7f4` |
| [`skills/security-and-hardening/references/hardening-patterns.md`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/security-and-hardening/references/hardening-patterns.md) (331 lines) | `ad1d8fe783a605fef5be622c02062626cc06a948` |
| [`references/security-checklist.md`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/references/security-checklist.md) (248 lines) | `910fbff3ff3ee67e343ef308fe224f95edb5b5ce` |

Neither skill folder has a `scripts/` directory. Frontmatter in both SKILL.md files is only `name` and `description`.

Method: grepped each file for `](`, `../`, `references/`, `scripts/`, `skills/`, `.md`/`.sh`/`.js`/`.mjs`, backticked kebab-case names, and the words skill/agent/command/hook/script. Then read both SKILL.md files in full.

### 2a. `skills/source-driven-development/SKILL.md`

Outside references:

- [L101](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/source-driven-development/SKILL.md#L101). This names another skill. There is no path.

  > For the underlying threat model (LLM01: Prompt Injection), follow the `security-and-hardening` skill — this section covers extraction hygiene, that one covers the threat model.

The file has no relative links, no `../` paths, no scripts, and no shared `references/` files. The other domain-like strings are prose examples of documentation sources, not links: L71-L74 (`react.dev`, `caniuse.com`, …), L87-L90, and L149/L160 (react.dev URLs inside example code).

### 2b. `skills/security-and-hardening/SKILL.md`

Outside references, all three to repo-root `references/security-checklist.md`:

- [L119](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/security-and-hardening/SKILL.md#L119)

  > Why the check is weaker than it reads (marker self-attestation, check/use races): [Destructive paths](references/hardening-patterns.md#destructive-operations-on-derived-paths). Worked code: `../../references/security-checklist.md`.

- [L140](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/security-and-hardening/SKILL.md#L140)

  > Triage decision tree: [Dependency audit triage](references/hardening-patterns.md#dependency-audit-triage). Manager matrix and install-script gate: `../../references/security-checklist.md`.

- [L166](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/security-and-hardening/SKILL.md#L166)

  > Before sign-off, walk `../../references/security-checklist.md`: it covers authentication, authorization, input, data protection and privacy, headers and CORS, dependencies and supply chain, AI/LLM, and error handling, plus the OWASP quick-reference tables.

Outside references that name other skills, with no path:

- [L147](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/security-and-hardening/SKILL.md#L147)

  > - **Collect only against a stated purpose.** "Might be useful later" is latent breach scope, not a purpose. Keep PII out of telemetry (the `observability-and-instrumentation` skill makes the same point from the ops side).

- [L152](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/security-and-hardening/SKILL.md#L152)

  > Classification table: [Data classification](references/hardening-patterns.md#data-classification). A privacy incident starts the breach-notification clock; run the postmortem with the `debugging-and-error-recovery` skill.

Inside-folder references (resolve within the folder): [L77](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/security-and-hardening/SKILL.md#L77), L85, L92, L100, L107, L113, L119, L125, L131, L140, L152, L162, all to `references/hardening-patterns.md#…`. The only external URL is L156 (`https://genai.owasp.org/llm-top-10/`).

### 2c. `skills/security-and-hardening/references/hardening-patterns.md`

Outside references, all to the repo-root checklist and three levels up:

- [L5](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/security-and-hardening/references/hardening-patterns.md#L5)

  > Shared checklists (threat modeling, pre-commit checks, security headers, CORS, the package-manager matrix, install-script gate, and the OWASP quick-reference tables) live in `../../../references/security-checklist.md`.

- [L9](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/security-and-hardening/references/hardening-patterns.md#L9)

  > These are prevention patterns, not a ranking. For the 2021 ordering, see the quick-reference table in `../../../references/security-checklist.md#owasp-top-10-quick-reference`.

- [L213](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/security-and-hardening/references/hardening-patterns.md#L213), ending:

  > … Worked example in `../../../references/security-checklist.md#destructive-path-operations`.

L3 names `security-and-hardening`, which is its own parent skill. The npm package names in code samples (`ipaddr.js` L136, `express-rate-limit`/`rate-limit-redis`/`@upstash/ratelimit` L264, `request-filtering-agent`/`ssrf-req-filter` L157) are third-party libraries, not repo files.

### 2d. `references/security-checklist.md`

Outside references:

- [L3](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/references/security-checklist.md#L3). This names a skill. There is no path.

  > Quick reference for web application security. Use alongside the `security-and-hardening` skill.

Everything else stays inside the file or points off-repo. L7-L19 are in-file `#anchor` links. L182 and L235 link to external docs (npm, pnpm, Yarn, OWASP GenAI). The file has no `../` paths and no links to other repo files.

### 2e. Upstream's own statement on the per-skill install gap

Upstream says per-skill installs drop the repo-root `references/` directory. [`README.md#L63-L68`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/README.md#L63-L68):

> **Installing one skill?** A per-skill `npx` install copies only
> `skills/<name>/`, not the repo-level `references/` directory. The skill still
> works, but paths to supplementary shared checklists are unavailable. Use a
> whole-repo integration, clone the repository, or copy the needed checklist into
> a `references/` directory inside the installed skill. This portability gap is
> tracked in [#361](https://github.com/addyosmani/agent-skills/issues/361).

[`docs/skill-anatomy.md#L120-L126`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/docs/skill-anatomy.md#L120-L126) gives the same rationale ("Checklists used by more than one skill … live in `references/` at the repository root, deliberately *not* inside any skill directory").

Note on the path strings: the `../../references/security-checklist.md` strings in SKILL.md point two levels above the skill folder. Copying the checklist into a `references/` directory inside the skill, as the README suggests, does not make those strings resolve unless they are edited. That conclusion comes from the path text alone. Status of upstream issue #361 was not checked.

> _Bears on ADR 0001, ADR 0010 and ADR 0015:_ ADR 0010 lists `aw-security-and-hardening` as a copy, and ADR 0001 and ADR 0015 allow a copy's text to change only by the mechanical `aw-` rename. Copied that way, the three `../../references/security-checklist.md` strings in `SKILL.md` and the three `../../../references/security-checklist.md` strings in `references/hardening-patterns.md` point outside the folder that `npx skills` installs (ADR 0002). Making them resolve means either shipping the checklist inside the folder and editing the paths (which makes the skill an adaptation, not a copy) or accepting the gap upstream documents. This is for the ticket that writes `upstreams.json`. This research does not decide it.

## 3. Spec ideas

**Answer:** Upstream's `spec-driven-development` skill covers (a): it splits Boundaries into Always / Ask first / Never. (b) Given/When/Then acceptance criteria: **not found** anywhere in the repo. (c) A spec status lifecycle: **not found** for specs. The spec has an approve-before-planning gate but no status field or states. The only status lifecycle in the repo is for ADRs, in `documentation-and-adrs`.

### (a) Boundaries: Always / Ask first / Never — found

[`skills/spec-driven-development/SKILL.md#L110-L113`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/spec-driven-development/SKILL.md#L110-L113):

```markdown
6. **Boundaries** — Three-tier system:
   - **Always do:** Run tests before commits, follow naming conventions, validate inputs
   - **Ask first:** Database schema changes, adding dependencies, changing CI config
   - **Never do:** Commit secrets, edit vendor directories, remove failing tests without approval
```

Spec template, [`#L138-L141`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/spec-driven-development/SKILL.md#L138-L141):

```markdown
## Boundaries
- Always: [...]
- Ask first: [...]
- Never: [...]
```

Verification item, [`#L256`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/spec-driven-development/SKILL.md#L256):

> - [ ] Boundaries (Always/Ask First/Never) are defined

The `/spec` command repeats it, [`.claude/commands/spec.md#L12`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/.claude/commands/spec.md#L12):

> 4. Known boundaries (what to always do, ask first about, and never do)

### (b) Given/When/Then acceptance criteria — not found

Where I looked: the whole tree at the pin (240 files, including `skills/`, `references/`, `agents/`, `commands/`, `.claude/commands/`, `docs/`, `evals/`), using `git grep`:

- `\b(Given|GIVEN)\b` returned one hit, unrelated prose in `skills/idea-refine/examples.md` L166 ("Given your architecture and the competitive context…").
- Lines containing `given` (case-insensitive) together with `when` or `then` returned nothing.
- `gherkin|\bbdd\b|given/when|scenario:` (case-insensitive) returned one false positive, `docs/adoption-guide.md` L26 ("best-case scenario:").

The spec skill asks for acceptance and success criteria with no fixed format:

- [`#L121`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/spec-driven-development/SKILL.md#L121): `[What we're building and why. User stories or acceptance criteria.]`
- [`#L143-L144`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/spec-driven-development/SKILL.md#L143-L144): `## Success Criteria` / `[How we'll know this is done — specific, testable conditions]`
- [`#L156-L166`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/spec-driven-development/SKILL.md#L156-L166): "Reframe instructions as success criteria" with a `REQUIREMENT:` → `REFRAMED SUCCESS CRITERIA:` example. It is not in Given/When/Then form.

### (c) Spec status lifecycle — not found for specs

Where I looked: `skills/spec-driven-development/SKILL.md` (read in full, 259 lines), `.claude/commands/spec.md`, `commands/spec.toml`, `.gemini/commands/spec.toml`, and a `git grep` of the full tree for `status:`, `draft`, `approved`, `lifecycle`, `spec status`, and `(draft|proposed) → (approved|accepted)`. The spec template ([L117-L148](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/spec-driven-development/SKILL.md#L117-L148)) has no Status section.

The closest things in the spec skill are an approval gate and a "living document" rule. Neither defines states.

- [`#L170-L174`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/spec-driven-development/SKILL.md#L170-L174):

  > **Stop after writing the spec (CRITICAL).** Once the spec is saved:
  >
  > 1. Summarize it and list any Open Questions.
  > 2. Ask the human to approve it or request changes.
  > 3. **STOP YOUR TURN IMMEDIATELY.** Do NOT start Phase 2, invoke `planning-and-task-breakdown`, or write code in this turn. Planning starts only after the human approves the spec in a later turn.

- [`#L216-L223`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/spec-driven-development/SKILL.md#L216-L223):

  > ## Keeping the Spec Alive
  >
  > The spec is a living document, not a one-time artifact:

The only status lifecycle in the repo covers ADRs, not specs. [`skills/documentation-and-adrs/SKILL.md#L53-L54`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/documentation-and-adrs/SKILL.md#L53-L54) and [`#L93-L97`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/documentation-and-adrs/SKILL.md#L93-L97):

```markdown
## Status
Proposed | Accepted | Superseded by ADR-XXX | Deprecated
```

```
PROPOSED → ACCEPTED → (SUPERSEDED or DEPRECATED)
```

## 4. Ship ideas

**Answer:** `shipping-and-launch` covers both. It has a sectioned pre-launch checklist and a "Rollback Strategy" section with a rollback-plan template. The `/ship` command wraps that skill and makes a rollback plan mandatory before a GO decision. `references/definition-of-done.md` has a "Ship-readiness" block. `git-workflow-and-versioning` covers preparing a change for review, through "Change Summaries" and "Pre-Commit Hygiene".

### `skills/shipping-and-launch/SKILL.md`

Frontmatter description, [`#L3`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/shipping-and-launch/SKILL.md#L3):

> description: Prepares production launches. Use when preparing to deploy to production, or when asking what needs to be in place before shipping. Use when you need a pre-launch checklist, when setting up monitoring, when planning a staged rollout, or when you need a rollback strategy.

Pre-launch checklist, [`#L20-L30`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/shipping-and-launch/SKILL.md#L20-L30). The first section is quoted below. The full checklist runs to L75, with further sections Security, Performance, Accessibility, Infrastructure and Documentation.

```markdown
## The Pre-Launch Checklist

### Code Quality

- [ ] All tests pass (unit, integration, e2e)
- [ ] Build succeeds with no warnings
- [ ] Lint and type checking pass
- [ ] Code reviewed and approved
- [ ] No TODO comments that should be resolved before launch
- [ ] No `console.log` debugging statements in production code
- [ ] Error handling covers expected failure modes
```

Rollback strategy, [`#L257-L284`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/shipping-and-launch/SKILL.md#L257-L284):

````markdown
## Rollback Strategy

Every deployment needs a rollback plan before it happens:

```markdown
## Rollback Plan for [Feature/Release]

### Trigger Conditions
- Error rate > 2x baseline
- P95 latency > [X]ms
- User reports of [specific issue]

### Rollback Steps
1. Disable feature flag (if applicable)
   OR
1. Deploy previous version: `git revert <commit> && git push`
2. Verify rollback: health check, error monitoring
3. Communicate: notify team of rollback

### Database Considerations
- Migration [X] has a rollback: <verified command or runbook link>
- Data inserted by new feature: [preserved / cleaned up]

### Time to Rollback
- Feature flag: < 1 minute
- Redeploy previous version: < 5 minutes
- Database rollback: < 15 minutes
```
````

The rest of the skill: feature-flag lifecycle (L94-L102), staged rollout and rollout decision thresholds (L110-L160), post-launch verification (L231-L242), error-budget release gate (L244-L255), and before/after-deploy verification lists (L315-L336).

This skill also points outside its folder. [`#L287-L291`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/shipping-and-launch/SKILL.md#L287-L291) links `../../references/definition-of-done.md`, `../../references/security-checklist.md`, `../../references/performance-checklist.md`, `../../references/accessibility-checklist.md`, and names the `observability-and-instrumentation` skill.

### `/ship` command: `.claude/commands/ship.md`

[`#L8`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/.claude/commands/ship.md#L8):

> `/ship` is a **fan-out orchestrator**. It runs three specialist personas in parallel against the current change, then merges their reports into a single go/no-go decision with a rollback plan.

Output template, [`#L44-L65`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/.claude/commands/ship.md#L44-L65):

```markdown
## Ship Decision: GO | NO-GO

### Blockers (must fix before ship)
- [Source persona: Critical finding + file:line]

### Recommended fixes (should fix before ship)
- [Source persona: Important finding + file:line]

### Acknowledged risks (shipping anyway)
- [Risk + mitigation]

### Rollback plan
- Trigger conditions: [what signals would prompt rollback]
- Rollback procedure: [exact steps]
- Recovery time objective: [target]

### Specialist reports (full)
- [code-reviewer report]
- [security-auditor report]
- [test-engineer report]
```

[`#L71-L72`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/.claude/commands/ship.md#L71-L72):

> 3. The rollback plan is mandatory before any GO decision.
> 4. If any persona returns a Critical finding, the default verdict is NO-GO unless the user explicitly accepts the risk.

### `references/definition-of-done.md`

[`#L47-L51`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/references/definition-of-done.md#L47-L51):

```markdown
### Ship-readiness
- [ ] Security implications reviewed for any untrusted input, auth, or data handling (see `security-and-hardening`)
- [ ] Observability in place for new critical paths (logs, metrics, traces) (see `observability-and-instrumentation`)
- [ ] Rollback path exists for anything risky (see `shipping-and-launch`)
- [ ] The human has reviewed and approved before merge or deploy
```

> _Differs from ADR 0013:_ the last item makes human review before merge a requirement. ADR 0013 rejected human PR review as a fixed gate. Quoted here as evidence only.

### Preparing a change for review: `skills/git-workflow-and-versioning/SKILL.md`

[`#L191-L193`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/git-workflow-and-versioning/SKILL.md#L191-L193):

> ## Change Summaries
>
> After any modification, provide a structured summary. This makes review easier, documents scope discipline, and surfaces unintended changes:

The template that follows (L195-L207) has `CHANGES MADE:`, `THINGS I DIDN'T TOUCH (intentionally):` and `POTENTIAL CONCERNS:`. "Pre-Commit Hygiene" ([`#L211-L230`](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/git-workflow-and-versioning/SKILL.md#L211-L230)) lists staged-diff review, a secrets grep, tests, lint, and type check.

## 5. Pin

**Answer:** Pin `301b02b12bff98e4688e6984af6556802322bbde`, the latest commit on `main` as of 2026-11-04. The candidate prefix `301b02bbde` matches no commit, so a diff between candidate and latest is **Unconfirmed**. Against the nearest release tag `0.6.15`, latest has no differences in any path the kit cares about.

### Candidate prefix does not resolve

What I tried:

- `gh api repos/addyosmani/agent-skills/commits/301b02bbde` returned HTTP 422 "No commit found for SHA: 301b02bbde".
- `gh api repos/addyosmani/agent-skills/compare/301b02bbde...main` and `git/trees/301b02bbde` both returned HTTP 404.
- I cloned the repo blobless with all branches and tags, then fetched all 583 `refs/pull/*/head` refs. `git rev-list --all` lists 3,239 commits. None starts with `301b02bbde`.
- The only commit starting with `301b02` is the latest commit, `301b02b12bff98e4688e6984af6556802322bbde`. Its first six hex digits (`301b02`) and last four (`bbde`) together spell the candidate string. The candidate is probably a garbled copy of the latest SHA, but that is an inference and **Unconfirmed**.

### Latest commit vs. tag `0.6.15`

Tag `0.6.15` is `8bfcc1f9916f2eea55494d8c1fa7f4bde867dd9e`, committed 2026-10-31T06:40:28Z. It is also the latest GitHub release, published 2026-10-31T06:40:31Z. `compare/0.6.15...301b02b12bff98e4688e6984af6556802322bbde` returns `status: ahead`, `ahead_by: 2`, `behind_by: 0`. Files changed:

```text
evals/cases/code-review-and-quality.json
evals/fixtures/review-evidence/CONTRACT.md
evals/fixtures/review-evidence/after.py
evals/fixtures/review-evidence/before.py
evals/fixtures/review-evidence/clean.py
skills/code-review-and-quality/SKILL.md   (+2 lines)
```

Between `0.6.15` and latest, none of these paths changed: `LICENSE`, `skills/source-driven-development/`, `skills/security-and-hardening/`, `references/security-checklist.md`, `skills/spec-driven-development/`, `skills/shipping-and-launch/`, `.claude/commands/ship.md`, `references/definition-of-done.md`. Nothing was renamed, removed or moved. The license and frontmatter are unchanged and the layout is the same. For these paths, pinning `0.6.15` and pinning latest give identical content.

Last commit touching each relevant path, for judging churn:

| Path | Last commit | Date |
|---|---|---|
| `LICENSE` | `3e4a665` | 2026-02-15 |
| `skills/source-driven-development/` | `76cbb8a` | 2026-10-23 |
| `skills/security-and-hardening/` | `d051d88` (merge of #759) | 2026-10-30 |
| `references/security-checklist.md` | `30187c1` | 2026-10-29 |
| `skills/spec-driven-development/` | `0004999` | 2026-10-15 |
| `skills/shipping-and-launch/` | `dde32ac` | 2026-10-13 |

There has been one layout change in the security skill. `skills/security-and-hardening/references/hardening-patterns.md` was added on 2026-09-18 in `623af98` ("refactor(security-and-hardening): move code patterns out of SKILL.md into a skill-local reference"). A pin older than that would have a different folder layout. I did not diff older commits.

Why latest rather than `0.6.15`: both have identical content for the relevant paths. Latest is the commit the candidate most likely meant. Pinning the tag commit `8bfcc1f9916f2eea55494d8c1fa7f4bde867dd9e` instead would be equally valid if the kit prefers release tags.

## Out of scope

Writing `NOTICE.md`, `upstreams.json` or any skill.
