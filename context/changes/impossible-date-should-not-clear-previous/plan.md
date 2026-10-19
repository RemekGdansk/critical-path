# Impossible START Date Keeps the Previous One — Implementation Plan

## Overview

An impossible or partly filled date typed into the "START date" field (e.g. 02/30/2026) currently clears the START date without a message. After this change the panel keeps the committed START date (or keeps it unset), names the `start-date-not-a-date` Validation Error in the domain's own wording, and leaves every committed view on the previous project. Source: the follow-up "an impossible START date clears the date" in `context/changes/invariant-aggregate-refactor/change.md:32-34`.

## Current State Analysis

- Chromium's native date input reports `""` as its value for a date it cannot read: typing 2026, 02, 30 gives the values `2026-02-02`, `2026-02-03`, `""` (follow-up, `context/changes/invariant-aggregate-refactor/change.md:34`). The element's `validity.badInput` is then `true`; with every segment emptied the value is also `""` but `badInput` is `false`.
- `StartPanel` commits the draft on Enter (`src/components/planner/StartPanel.tsx:68-72`), on blur (`:103-106`) and at once for a change with no preceding key press (`:95-98`, the calendar popup). `commit()` (`:58-65`) passes the value straight to `setStartDate`, so `""` reaches the domain.
- `setStartDate` in the domain treats `""` as "clear the date" (`src/lib/services/project.ts:282-288`). So the impossible date silently clears a valid START date, and `start-date-not-a-date` is never reached from the panel; it is reachable only through the hook (`src/hooks/useProject.test.ts:125-129`) and import (`src/lib/services/project-file.test.ts:373`).
- `commit()` returns early when the value equals the committed date (`StartPanel.tsx:59`). With START unset, an impossible date is `""` = `""`, so today it is dropped silently too.
- Escape (`StartPanel.tsx:73-76`) and Clear (`:115-120`) set the draft to `""`. React writes a controlled input's value only when it differs from the DOM's current value; on an unreadable field the DOM value is already `""`, so the impossible segments would stay on screen after either.
- The message lives in the domain only: `START_DATE_MESSAGE` (`project.ts:252`), used by the rule-list entry for `start-date-not-a-date` (`project.ts:406-409`). The glossary makes `project.ts` the guardian and sole owner of Validation Errors (`context/domain/glossary.md:31,34`).
- jsdom implements `ValidityState.badInput` but never reports it true, and sanitizes an impossible date to `""`. A jsdom test can only stub `validity` on the element; the real browser behaviour is observable only in Playwright on Chromium (`playwright.config.ts`, `Desktop Chrome`, default locale en-US, so segments read mm/dd/yyyy).

## Desired End State

- In the built app, typing an impossible date (02/30/2026) or a partly filled one into "START date" and pressing Enter or leaving the field shows a `role="alert"` reading "The START date must be a calendar date from 0001-01-01 to 9999-12-31.", marks the field `aria-invalid`, and keeps the START node, the note and both Project Finish Dates on the previously committed START date. With START unset, the same alert appears and START stays unset.
- Escape restores the field to the committed START date (or empties it) and removes the alert. Clear still clears the START date and leaves an empty field with no alert.
- Emptying every segment and committing still clears the START date, as the browsers' own clear control does.
- The wording comes from one domain export, which the rule list also uses, so the panel and the guardian cannot drift apart.

Verified by: a domain test (`project.test.ts`), a jsdom `Planner` test with `validity.badInput` stubbed, and a Chromium e2e test that types the impossible date into the real field.

### Key Discoveries:

- `commit()`'s early return on an unchanged value (`StartPanel.tsx:59`) hides the START-unset case; the unreadable check must run before it.
- A change event with no preceding key press commits at once (`StartPanel.tsx:97`), so a jsdom test must fire a key press before `fireEvent.change` to drive the typed-draft path, as a user would.
- The cookbook already rules that a rejected draft stays in the field (`context/foundation/test-plan.md` §6.2, "Rejected edit in the view"); the unreadable date follows the same rule.
- `Planner.test.ts`'s fixture has START 2999-01-01 with forecast dates `2999-01-06` / `2999-01-09` (`src/components/planner/Planner.test.ts:40-45, 93-95`), the oracle for "every committed view still shows the previous project".

## What We're NOT Doing

- No change to `setStartDate` in the domain: `""` keeps meaning "clear the date".
- No other browsers: the test matrix is Chromium only (`context/foundation/test-plan.md` §7). Browsers that do not report `badInput` for a date input keep today's behaviour.
- No change to the Duration field (a number input that can also report `badInput`) or other inputs; this change is the START date only.
- No new hook action or `useProject` row: the panel calls no edit for an unreadable date, so planner state is untouched by construction.
- No glossary or PRD edit; the rule and its wording already exist.

## Implementation Approach

The browser hides the raw text of an unreadable date, so the decision "this is not a date" has to be made where `validity.badInput` is visible: in `StartPanel`. The wording stays in the domain. `project.ts` exports the `start-date-not-a-date` Validation Error as a function, and the rule list builds its entry from the same function. `StartPanel` shows that error and calls no edit, so the project is never touched. One guard inside `commit()`, ahead of the early return, covers Enter, blur and the immediate-change path alike. Clear and Escape reset the field's DOM value explicitly, so no unreadable segments outlive them and leave `badInput` set.

## Critical Implementation Details

- **State sequencing (Clear):** Clear must reset the input's DOM value before it commits `""`. Otherwise the guard sees `badInput` still true and shows the message instead of clearing. Escape likewise resets the DOM value to the committed date (or `""`). Assigning `value` on a Chromium date input clears the edited segments and `badInput`.

## Phase 1: Keep the START date on an unreadable date

### Overview

The domain exports the error and the panel guards on `badInput`. Domain and jsdom tests pin both the START-set and START-unset cases.

### Changes Required:

#### 1. The `start-date-not-a-date` Validation Error as a domain export

**File**: `src/lib/services/project.ts`

**Intent**: Give the view the exact Validation Error the guardian reports for a START date that is not a date, so a rejection the panel decides itself uses the guardian's wording.

**Contract**: New export `startDateNotADate(): ValidationError` returning `{ rule: "start-date-not-a-date", message: START_DATE_MESSAGE }` (a fresh object per call), with a one-line doc comment saying the view uses it for a date the browser cannot read. The `PROJECT_CHECKS` entry for the START date (`project.ts:406-409`) returns `startDateNotADate()` instead of its inline literal. Behaviour of `setStartDate` and `validateProject` is unchanged.

#### 2. Domain test: one error, two paths

**File**: `src/lib/services/project.test.ts`

**Intent**: Prove that the panel's error and the guardian's error are the same, so they cannot drift.

**Contract**: One case next to the existing `start-date-not-a-date` rows (`project.test.ts:367`): rejecting `setStartDate(<project>, "2026-02-30")` gives an `error` that `toStrictEqual(startDateNotADate())`. The message contains none of "invalid", "conflict" or "blocked".

#### 3. StartPanel: an unreadable date keeps the START date

**File**: `src/components/planner/StartPanel.tsx`

**Intent**: When the field's value is `""` and `validity.badInput` is true, show the domain's message and keep the committed START date. When the value is `""` and `badInput` is false (every segment emptied), keep today's clearing.

**Contract**:

- `commit(value)` first checks `value === "" && dateRef.current?.validity.badInput === true`. If so, it sets the error to `startDateNotADate().message` and returns without calling `setStartDate`. This check runs before the unchanged-value early return, so it also applies with START unset.
- Clear sets the input's DOM value to `""` before `commit("")`. Escape sets it to `date ?? ""` alongside `setDraft`.
- The existing `aria-invalid` / `role="alert"` / `aria-describedby` wiring is reused unchanged.
- The component's doc comment (`StartPanel.tsx:20-28`) is updated. Emptying every segment clears the date. An impossible or partly filled date (`validity.badInput`) keeps it and names the START date rule.

#### 4. jsdom Planner test: the committed views keep the previous START date

**File**: `src/components/planner/Planner.test.ts`

**Intent**: Pin the fix through the real hook and domain. A rejected unreadable date shows the rule's message, and every committed view still shows the previous project.

**Contract**:

- A `describe` block, "Planner: an unreadable START date keeps the previous one", follows the §6.2 "Rejected edit in the view" pattern.
- The panel is opened with `initialSelection: "start"`; `renderPlanner` gains an optional selection argument.
- A local helper commits an unreadable date the way a user does. It fires a key press on "START date" so the draft path is taken, stubs `validity` on that element with `badInput: true` (an own property via `Object.defineProperty`, `configurable: true`), fires `fireEvent.change` with `"2026-02-30"` (jsdom sanitizes it to `""`, as Chromium reports it), then fires `fireEvent.keyDown` Enter (one case) or `fireEvent.blur` (the other).
- Cases:
  - **START set (fixture 2999-01-01):** the alert holds "The START date must be a calendar date from 0001-01-01 to 9999-12-31." with none of "invalid", "conflict" or "blocked". The START node's accessible name still holds `2999-01-01`. The forecast still reads `2999-01-06` / `2999-01-09`. No "Not set" note appears.
  - **START unset** (the fixture with the date cleared through `setStartDate(…, "")`): the same alert, and the "Not set: the forecast starts from today" note still shows.
  - **Every segment emptied** (no stub, `badInput` false): committing `""` still clears the date, as before. This guards against an over-broad check.

### Success Criteria:

#### Automated Verification:

- Domain and planner tests pass: `npx vitest run src/lib/services/project.test.ts src/components/planner/Planner.test.ts`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Full suite passes: `npm test`

#### Manual Verification:

- Under `npm run dev` in Chromium, typing 02/30/2026 into "START date" over a set date and pressing Enter shows the alert and keeps the START node, note and both Project Finish Dates. Escape then restores the field and removes the alert. Clear then empties the field with no alert.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Pin it in Chromium and document

### Overview

An e2e test proves the premise jsdom can only stub: Chromium really reports `""` with `badInput` for an impossible date. It also proves the built app keeps the START date. The docs record the stub pattern and close the loop on the follow-up.

### Changes Required:

#### 1. E2E: an impossible START date in the real field

**File**: `e2e/start-date.spec.ts` (new)

**Intent**: Type an impossible date into the real Chromium date input on the built app, with the CSP in effect, and check the START date survives.

**Contract**:

- Header comment in the style of `e2e/forecast-today.spec.ts:1-7`, naming the risk (test-plan #5, view side) and `seed: e2e/seed.spec.ts`. `test.use({ locale: "en-US" })` pins the segment order to mm/dd/yyyy.
- Steps, in one test:
  1. Open the planner, asserting the served page carries `connect-src 'none'` as the other specs do.
  2. Add a Task with a Duration and set START to a far-future date via `fill`.
  3. Focus "START date" and type `02`, `30`, `2026` with the keyboard.
  4. Assert through `evaluate` that the field's value is `""` and `validity.badInput` is `true`. This is the browser premise.
  5. Press Enter, then assert the alert text, that the `START, <date>` node is unchanged and that both Project Finish Dates are unchanged.
  6. Press Escape, then assert the field shows the committed date again and the alert is gone.
  7. Type only the month segment and press Enter (a partly filled date); assert the same alert and an unchanged START node.
- No console errors, collected as in `e2e/project-file.spec.ts`.

#### 2. Cookbook note for the stubbed `validity`

**File**: `context/foundation/test-plan.md`

**Intent**: Record how a jsdom test reaches an unreadable native input, and that the browser premise belongs to e2e, so the next such test follows the same split.

**Contract**: One sentence appended to the §6.2 "Rejected edit in the view" bullet. jsdom never reports `validity.badInput`, so a planner test stubs `validity` on the element and fires a key press first, so the typed-draft path is taken. The browser behaviour itself is proven in Chromium by `e2e/start-date.spec.ts`.

#### 3. Close the follow-up

**File**: `context/changes/invariant-aggregate-refactor/change.md`

**Intent**: Point the follow-up at the change that fixes it.

**Contract**: One line appended under the "Follow-up: an impossible START date clears the date" heading: "Fixed in change `impossible-date-should-not-clear-previous`."

### Success Criteria:

#### Automated Verification:

- E2E passes against build + preview: `npm run test:e2e -- e2e/start-date.spec.ts`
- Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`
- Full E2E suite passes: `npm run test:e2e`

#### Manual Verification:

- The test-plan §6.2 sentence and the follow-up line read correctly in context, with no line breaks inserted mid-paragraph.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `project.test.ts`: the rejection of `"2026-02-30"` equals `startDateNotADate()`.

### Integration Tests:

- `Planner.test.ts` (jsdom, real hook and domain): an unreadable date committed by Enter and by blur, with START set and with START unset. The alert names the rule; the START node, note and both Project Finish Dates keep the committed project. Emptying every segment still clears the date.
- `e2e/start-date.spec.ts` (Chromium, built app): the browser premise (`""` + `badInput`), an impossible and a partly filled date, Escape restoring the field.

### Manual Testing Steps:

1. `npm run dev`, Chromium: add a Task with a Duration, set START to a date, then type 02/30/2026 into "START date" and press Enter. The alert shows, and the START node and Project Finish Dates are unchanged.
2. Press Escape: the field shows the committed date again and the alert is gone.
3. Type 02/30/2026 again, then click Clear: the START date is cleared, the field is empty, no alert.
4. With START unset, type 02/30/2026 and leave the field. The alert shows, and the "Not set" note remains.

## References

- Follow-up: `context/changes/invariant-aggregate-refactor/change.md:32-34`
- Panel: `src/components/planner/StartPanel.tsx:58-120`
- Domain: `src/lib/services/project.ts:252, 282-288, 406-409`
- Test patterns: `context/foundation/test-plan.md` §6.2; `src/components/planner/Planner.test.ts:118-131`; `e2e/forecast-today.spec.ts`, `e2e/project-file.spec.ts`
- Glossary: `context/domain/glossary.md` (Validation Error, Guardian, START date)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Keep the START date on an unreadable date

#### Automated

- [x] 1.1 Domain and planner tests pass: `npx vitest run src/lib/services/project.test.ts src/components/planner/Planner.test.ts` — b652129
- [x] 1.2 Lint passes: `npm run lint` — b652129
- [x] 1.3 Type check passes: `npx astro check` — b652129
- [x] 1.4 Full suite passes: `npm test` — b652129

#### Manual

- [x] 1.5 Under `npm run dev` in Chromium, an impossible START date shows the alert and keeps the START date; Escape and Clear behave — b652129

### Phase 2: Pin it in Chromium and document

#### Automated

- [x] 2.1 E2E passes against build + preview: `npm run test:e2e -- e2e/start-date.spec.ts`
- [x] 2.2 Full gate passes: `npm run lint && npx astro check && npm test && npm run build && npm run check:csp`
- [x] 2.3 Full E2E suite passes: `npm run test:e2e`

#### Manual

- [x] 2.4 The test-plan §6.2 sentence and the follow-up line read correctly in context
