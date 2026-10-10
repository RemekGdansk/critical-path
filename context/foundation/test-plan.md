# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship. Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-10-10

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the risk wins. Do not promote to e2e because e2e "feels safer." Do not put a vision model on top of a deterministic check that already catches the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the maintainer is worried about X, and the failure would surface somewhere in <area>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what could fail_ and _why we believe it's likely_ — drawn from documents, interview, and codebase _signal_ (churn, structure, test base). It does NOT claim to know which line owns the failure. That knowledge is produced by `/10x-research` during each rollout phase. If the plan and research disagree about where the failure lives, research is the ground truth.

Expected values in every test come from an independent oracle — the PRD's worked examples, Business Logic rules and acceptance criteria, or a committed fixture — never from the output of the code under test.

Hot-spot scope used for likelihood weighting: `src/` (excluding `src/dev/`), `scripts/`. 30-day churn: `src/components/planner/` 32 file-changes, `src/lib/services/` 29, `src/styles/` 8, `src/hooks/` 3 (15 commits).

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by risk = impact × likelihood. Risks are failure scenarios in user / business terms, not test names. The Source column cites the _evidence that surfaced this risk_ — never a specific file as "where the failure lives" (that is research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                                                                                  | Impact | Likelihood | Source (evidence — not anchor)                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A project file exported by an earlier version of the app can no longer be imported once the file format gains fields (Statuses, completion dates, day-counting mode)                     | High   | High       | interview Q1; roadmap S-03 Risk line; roadmap S-06 and S-07 add file fields; PRD Guardrails ("no silent data loss")                 |
| 2   | Export then import yields a project that differs from the original — a lost Duration, a changed id or order, or an id counter that later mints a duplicate Task id and overwrites a Task | High   | High       | PRD Guardrails; US-03; FR-013, FR-014; archive `2026-09-27-capture-task-graph` follow-up F1                                         |
| 3   | A hand-edited file holding a Validation Error (cycle, unknown id, malformed date or Task name) is accepted, or blanks the planner instead of being rejected with a clear error           | High   | High       | FR-014; US-03 acceptance criteria; roadmap S-03 Risk line; untrusted-input lens (the imported file is the app's only foreign input) |
| 4   | The Resource-Unconstrained or Resource-Constrained Project Finish Date is wrong but plausible — off by a day, wrong "today" versus the START date, or wrong under parallelism            | High   | High       | PRD Business Logic worked examples; US-02; US-04; interview Q3; hot-spot dir `src/lib/services/` (29 file-changes/30d)              |
| 5   | An edit rejected as a Validation Error still leaves the planner's state partly changed, or shown as changed                                                                              | High   | Medium     | interview Q4; FR-019; hot-spot dirs `src/components/planner/` (32/30d), `src/hooks/` (3/30d)                                        |
| 6   | A Project Finish Date, or a stale one, stays visible while a Validation Warning exists                                                                                                   | High   | Medium     | PRD Guardrails; FR-009; roadmap S-07 Risk line (withheld copy changes for Done Tasks)                                               |
| 7   | Project data leaves the device because the CSP is loosened, or never reaches the served page, while every gate stays green                                                               | High   | Low        | PRD Guardrails and NFR; `lessons.md` "Verify the artifact, not the config"; PROJECT_RULES hard rule                                 |

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                                                  | Must challenge                                                                                                                                   | Context `/10x-research` must ground                                                                                                              | Likely cheapest layer                                          | Anti-pattern to avoid                                                |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| #1   | A committed file from every shipped format version still imports to the expected project; fields absent from older files get documented defaults                             | "Same-version round-trip passes, so old files import" — a same-version round-trip never exercises an old file                                    | Whether the file carries a format version; defaults for absent fields; which fields S-06 and S-07 add                                            | unit / contract on committed golden files                      | Regenerating golden files from the current exporter (oracle problem) |
| #2   | Every US-03 field survives export → import, including Task ids and the id counter; exporting twice gives byte-identical text; a Task created after import never reuses an id | "Deep-equal after the same serializer proves no loss"                                                                                            | Project model fields, id allocation, serialization ordering                                                                                      | unit, over generated projects                                  | Comparing through a normalizer that can itself drop fields           |
| #3   | Each PRD Validation Error placed in a file is rejected with an error naming the rule; the current project is unchanged; the planner never throws or blanks                   | "Editing rules already enforce it, so import is safe" / "It parsed, so it is valid"                                                              | Whole-project validation shared with the edit rules (follow-up F1); parse-failure handling; what the forecast throws on                          | unit, one table row per PRD Validation Error + malformed input | Happy-path-only, or testing only the cycle case                      |
| #4   | The PRD worked examples (US-02, US-04, Business Logic) reproduce exactly with "today" controlled; a START date in the past is replaced by today                              | "Existing forecast tests pass, so the forecast is right" — check where their expected values came from / "A UTC day equals the user's local day" | How "today" is obtained; date representation and time zone; which examples are testable before S-06 and S-07 land (the rest become their oracle) | unit, table-driven, fixed clock                                | Expected dates computed with production's own date helper            |
| #5   | For each rejected edit kind, planner state after the rejection equals state before it, and the message names the rule                                                        | "The domain returned an error, so state is untouched"                                                                                            | The state hook's update path; how errors surface; derived state such as selection and form inputs                                                | integration at hook level (DOM environment)                    | Mocking the domain layer inside the hook test                        |
| #6   | With a not-Done Task missing a Duration, neither Project Finish Date nor the remaining-work times render; both reappear once it is fixed                                     | "The forecast returns nothing, so the UI hides it" — a stale or memoized value may still show                                                    | Where withholding is decided; memoization of forecast results                                                                                    | unit + one hook-level check                                    | Asserting only the domain return value                               |
| #7   | Every built page carries a CSP with `connect-src 'none'` and no third-party origins; the check fails when the policy is loosened                                             | "The Astro config has a CSP, so the served page has it"                                                                                          | Where Astro emits the CSP; build order in GitHub Actions and in Cloudflare Workers Builds                                                        | post-build artifact check                                      | Asserting the config object instead of the built HTML                |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder via `/10x-new`. Status moves left-to-right through the values below; the orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                      | Goal (one line)                                                                                                                           | Risks covered          | Test types                    | Status        | Change folder          |
| --- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------- | ------------- | ---------------------- |
| 1   | Forecast oracle                 | Prove both Project Finish Dates match the PRD worked examples under a fixed clock and are withheld while warned                           | #4, #6                 | unit (fixed clock)            | change opened | testing-forecast-dates |
| 2   | Edit-rejection atomicity        | Prove a rejected edit leaves the planner's state identical and names the rule                                                             | #5, #6                 | integration (hook, DOM env)   | not started   | —                      |
| 3   | Project file contract           | Prove older files import, the round-trip is exact, and files with Validation Errors are rejected without harm (after roadmap S-03 merges) | #1, #2, #3             | unit / contract, golden files | not started   | —                      |
| 4   | Built-artifact guarantee        | Prove the built pages forbid network egress, checked in both pre-merge and deploy gates                                                   | #7                     | post-build artifact check     | not started   | —                      |
| 5   | Agent-loop feedback (AI-native) | Run the related domain and state tests when an agent edits forecast or planner-state code                                                 | #4, #5 (cross-cutting) | post-edit hook                | not started   | —                      |

Order rationale: Phase 1 targets the area changed least confidently (interview Q3) and a hot-spot, before roadmap S-06 and S-07 change the forecast. Phase 2 closes the gap named in interview Q4 on code that already exists. Phase 3 carries the highest-impact risks but its code lands with roadmap S-03; S-03's own plan should adopt the #1–#3 response guidance now, and Phase 3 locks the contract in afterwards. Phase 4 is cheap and independent. Phase 5 runs only once Phases 1–2 give it tests worth running.

## 4. Stack

| Layer                  | Tool                                                        | Version | Notes                                                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| unit                   | Vitest                                                      | 5.0.x   | Configured; discovers `src/**/*.test.ts` only; Node environment. Test base: sparse — 7 test files, all domain services. `vi.setSystemTime` controls "today" (checked: 2026-10-10). |
| integration (hooks)    | Vitest with a per-file DOM environment (jsdom or happy-dom) | n/a     | none yet — see §3 Phase 2. Choice of DOM library and hook renderer is research's call.                                                                                             |
| contract (file format) | Vitest + committed golden project files                     | n/a     | none yet — see §3 Phase 3.                                                                                                                                                         |
| built artifact         | Post-build check over `dist/`                               | n/a     | none yet — see §3 Phase 4. Runs after `npm run build`, so it cannot live inside the current pre-build `npm test` step.                                                             |
| e2e                    | none                                                        | n/a     | Not planned. Promote only if a phase's research shows a risk unreachable below the browser (e.g. the file picker path); one desktop browser only (§7).                             |
| accessibility          | eslint-plugin-jsx-a11y (static)                             | 6.10.2  | Already in `npm run lint`; no runtime a11y checks planned.                                                                                                                         |
| (optional) AI-native   | Claude Code post-edit hook — checked: 2026-10-10            | n/a     | §3 Phase 5. When NOT to use: UI-only or styling edits, or when the related tests take longer than a few seconds; it never replaces the CI gate.                                    |

**Stack grounding tools (current session):**

- Docs: Context7 — checked Vitest 5.0.3 for `vi.useFakeTimers` / `vi.setSystemTime` and per-file `jsdom` / `happy-dom` environments; checked: 2026-10-10
- Search: Exa.ai — available, not needed (official docs via Context7 sufficed); checked: 2026-10-10
- Runtime/browser: Claude in Chrome — available for manual verification only; no Playwright MCP in current session; checked: 2026-10-10
- Provider/platform: Cloudflare MCP — available; no quality-gate role (deploy gates run in Workers Builds' build command); checked: 2026-10-10

## 5. Quality Gates

| Gate                                | Where                                             | Required?                        | Catches                                                |
| ----------------------------------- | ------------------------------------------------- | -------------------------------- | ------------------------------------------------------ |
| `astro sync` + lint + `astro check` | pre-commit (lint), GitHub Actions, Workers Builds | required                         | type drift, literal colours, a11y lint                 |
| unit + integration (`npm test`)     | local + GitHub Actions + Workers Builds           | required (grows with Phases 1–3) | forecast, edit-rejection and file-contract regressions |
| golden-file contract tests          | inside `npm test`                                 | required after §3 Phase 3        | older files no longer importing                        |
| built-artifact CSP check            | after build, GitHub Actions + Workers Builds      | required after §3 Phase 4        | CSP loosened or missing from served pages              |
| post-edit hook                      | local (agent loop)                                | recommended after §3 Phase 5     | forecast / state regressions at edit time              |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once the relevant rollout phase ships; before that, the sub-section reads "TBD — see §3 Phase N."

### 6.1 Adding a domain unit test with a PRD oracle

- TBD — see §3 Phase 1 for the forecast worked-example pattern (fixed clock, expected dates taken from the PRD).
- Existing reference until then: colocated `src/lib/services/*.test.ts`; run with `npm test`.

### 6.2 Adding a planner-state test for a rejected edit

- TBD — see §3 Phase 2 for the "state before equals state after a rejected edit" pattern.

### 6.3 Adding a file-format change or a new import rule

- TBD — see §3 Phase 3 for the golden-file backward-compatibility pattern and the one-row-per-Validation-Error rejection table.

### 6.4 Adding a check on the built artifact

- TBD — see §3 Phase 4 for the post-build CSP pattern.

### 6.5 Per-rollout-phase notes

(Appended after each phase lands.)

## 7. What We Deliberately Don't Test

- **Pixel-level visual snapshots of the diagram** — layout is auto-generated and changes legitimately. Re-evaluate if manual layout is ever added. (Source: Phase 2 interview Q5.)
- **shadcn/ui primitives in `src/components/ui/`** — vendored and tested upstream. Re-evaluate if a primitive is modified beyond styling. (Source: Phase 2 interview Q5.)
- **Cross-browser matrix runs** — one desktop browser is enough for a solo after-hours MVP. Re-evaluate if a browser-specific bug reaches users. (Source: Phase 2 interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-10-10
- Stack versions last verified: 2026-10-10
- AI-native tool references last verified: 2026-10-10

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
