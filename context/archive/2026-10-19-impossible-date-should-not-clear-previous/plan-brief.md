# Impossible START Date Keeps the Previous One — Plan Brief

> Full plan: `context/changes/impossible-date-should-not-clear-previous/plan.md`

## What & Why

Typing an impossible date (02/30/2026) or a partly filled one into "START date" clears a valid START date without a message, because Chromium reports such a date as `""`, and `""` means "clear". This change keeps the START date, names the `start-date-not-a-date` Validation Error in the domain's own wording, and leaves every committed view on the previous project. Source: the follow-up in `context/changes/invariant-aggregate-refactor/change.md:32-34`.

## Starting Point

`StartPanel.commit()` passes the field's value straight to `setStartDate` on Enter, on blur and on a change with no preceding key press (the calendar popup). It returns early when the value equals the committed date, so with START unset an impossible date is dropped silently. The message exists only in the domain (`START_DATE_MESSAGE`, used by the rule list's `start-date-not-a-date` entry). jsdom never reports `validity.badInput`.

## Desired End State

An impossible or partly filled date shows "The START date must be a calendar date from 0001-01-01 to 9999-12-31." as an alert and keeps the START date (or keeps it unset). The START node, the note and both Project Finish Dates do not change. Escape restores the field, Clear still clears, and emptying every segment still clears the date.

## Key Decisions Made

| Decision              | Choice                                                                                                   | Why (1 sentence)                                                                                                                     | Source    |
| --------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| Trigger               | Value `""` with `validity.badInput` true; `""` without it (every segment emptied) still clears           | The browser hides the raw text, and `badInput` is the only signal that tells "unreadable" from "emptied"                             | Follow-up |
| Owner of the error    | `project.ts` exports `startDateNotADate()`; the rule list uses it too; the panel shows it, calls no edit | Wording stays with the guardian with no sentinel string in the view, and the project is never touched                                | Plan      |
| Field after rejection | The impossible date stays in the field; Escape restores it                                               | Cookbook §6.2 already rules that a rejected draft stays in the field                                                                 | Codebase  |
| START unset           | Same alert, START stays unset                                                                            | Today's early return hides this case; the guard runs before it                                                                       | Plan      |
| Test layers           | jsdom `Planner` test with `validity` stubbed + Chromium e2e                                              | Only a real browser proves it reports `""` + `badInput` (lesson "Verify the artifact, not the config"); jsdom keeps it in both gates | Plan      |

## Scope

**In scope:**

- `startDateNotADate()` export and rule-list reuse in `src/lib/services/project.ts`
- The `badInput` guard in `StartPanel.commit()`, with a DOM value reset on Clear and Escape, and its doc comment
- Tests in `project.test.ts` and `Planner.test.ts`, and the new `e2e/start-date.spec.ts`
- A sentence in test-plan §6.2 and a line closing the follow-up

**Out of scope:**

- Changing `setStartDate` (`""` still clears)
- Browsers other than Chromium, the Duration field, and other inputs
- A new hook action or `useProject` row

## Architecture / Approach

The panel decides "not a date", because only the panel can see `validity.badInput`; the domain supplies the words. One guard at the top of `commit()` covers Enter, blur and the immediate-change path, and it runs before the unchanged-value early return. Clear and Escape write the input's DOM value themselves, so no unreadable segments stay on screen and leave `badInput` set.

## Phases at a Glance

| Phase                                        | What it delivers                                                    | Key risk                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1. Keep the START date on an unreadable date | Domain export, `StartPanel` guard, domain and jsdom `Planner` tests | The jsdom stub must take the typed-draft path (a key press first) or it tests the popup path |
| 2. Pin it in Chromium and document           | `e2e/start-date.spec.ts`, test-plan §6.2 note, follow-up closed     | Segment typing is locale-dependent; pinned to en-US                                          |

**Prerequisites:** none; the branch `impossible-date-should-not-clear-previous` is open.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Assumes that assigning `value` on a Chromium date input clears its edited segments and `badInput`. Clear relies on this; the Phase 1 manual check and the e2e Escape step verify it.
- Firefox and Safari may not report `badInput` for a date input; they keep today's behaviour (outside the test matrix, test-plan §7).

## Success Criteria (Summary)

- An impossible or partly filled START date never changes the project; the user sees the START date rule named.
- Clearing on purpose (Clear, or emptying every segment) still works.
- The panel and the guardian show the same message, from one source.
