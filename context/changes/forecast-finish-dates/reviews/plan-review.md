<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Forecast Resource-Unconstrained and Resource-Constrained Project Finish Dates

- **Plan**: context/changes/forecast-finish-dates/plan.md
- **Mode**: Deep (claims verified directly against the code)
- **Date**: 2026-10-05
- **Verdict**: SOUND
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | WARNING |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

9/9 paths ✓, 8/8 symbols ✓ (diagram-layout.ts:49-54 flags, test at :124, TASK_NODE_HEIGHT 44, ariaRole on @xyflow/react 12.12, ETA/deadline grep currently empty), brief↔plan ✓, Progress↔Phase ✓ (3 phases, 19/19 criteria). Every worked example in the plan (PRD, US-02, past START, 9999-12-31 boundary) checks out by hand.

## Findings

### F1 — A Done Task without a Duration produces NaN dates

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 §3 Validation Warnings + §4 Forecast; What We're NOT Doing, bullet 1
- **Detail**: `validationWarnings` exempts Done Tasks, `forecast` withholds only when warnings exist, yet the forecast "treats every Task as remaining", so a Done Task with no Duration passes the withhold check and the forecast adds `undefined`. That is reachable through an S-03 import before S-07 adds the Done-rule import checks, and the plan's own hand-built Done test project has this shape. The PRD's Done rules force START ≤ completion ≤ today, so whenever a Task is Done the base date is already today, and a Done Task contributes exactly "0 days, finishes at the base date" — which yields all three PRD Done examples (6, 11, 8 Sep).
- **Fix A ⭐ Recommended**: In `forecast`, a Done Task contributes 0 days and finishes at the base date, excluded from the Resource-Constrained sum; add the PRD's three Done examples as hand-built tests.
  - Strength: Closes the NaN path with one branch, matches the PRD's "only remaining work" literally, and S-07 then adds editing and import rules with no forecast changes.
  - Tradeoff: Pulls a sliver of S-07 into S-04; the "not doing" bullet needs rewording.
  - Confidence: HIGH — follows from the PRD's completion-date rules.
  - Blind spot: The "all START successors Done" exception is subsumed only while START ≤ today holds for Done Tasks; S-07 must keep that rule.
- **Fix B**: Keep scope; `forecast` withholds (or throws) when any visited Task lacks a Duration, regardless of Status.
  - Strength: No S-07 semantics in S-04.
  - Tradeoff: A second withhold rule that drifts from the single Validation Warning definition, or a crash path S-03 must guard.
  - Confidence: MED.
  - Blind spot: The S-03 implementer must know about it.
- **Decision**: FIXED (Fix A)

### F2 — The forecast strip does not name the Task that lacks a Duration

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 3 §3 Forecast strip; Phase 1 §3 message
- **Detail**: US-02 expects "a Validation Warning that D is missing a Duration"; the strip shows only a count. `ValidationWarning.message` ("Design has no Duration.") is defined in Phase 1 but nothing renders it.
- **Fix**: The strip names the warned Tasks (up to 3, then "and N more"), or drop `message` from the type if only the count is wanted.
- **Decision**: FIXED

### F3 — Initial-selection plumbing not widened for "start-selected"

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §1, §3; Phase 3 §4
- **Detail**: The "start-selected" kitchen-sink cell needs START as the initial selection, but `useProject`'s `initialSelectedTaskId: TaskId | null` (useProject.ts:31), `PlannerProps.initialSelectedTaskId?: TaskId` (Planner.tsx:28) and the FIXTURES `satisfies` type (KitchenSinkPlanner.tsx:37) are in no contract. The fixture's "past START date" is unspecified; a today-relative one would drift.
- **Fix**: Phase 2 §1/§3: `initialSelection: Selection` in useProject and Planner; Phase 3 §4: the fixture uses a fixed past date (e.g. 2020-01-01).
- **Decision**: FIXED

### F4 — A partly typed START date clears the stored date

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details → START date commits on change; Phase 2 §3
- **Detail**: Clearing one segment of a native date input fires onChange with "", which per the contract clears the START date mid-edit; the Clear button disappears and the "Not set" note flashes until the date is complete. Harmless for the forecast, but undocumented and visible in manual check 2.6.
- **Fix**: Add one sentence to the Critical Implementation Details note accepting this.
- **Decision**: FIXED
