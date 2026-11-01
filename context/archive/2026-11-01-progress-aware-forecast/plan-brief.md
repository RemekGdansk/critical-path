# Progress-Aware Forecast (S-07) — Plan Brief

> Full plan: `context/changes/progress-aware-forecast/plan.md`
> Research: `context/changes/progress-aware-forecast/research.md`

## What & Why

Roadmap S-07: a user can mark Tasks To Do, In Progress or Done (Done with a completion date) and see both Project Finish Dates follow progress. Every edit or imported file that breaks a Done rule is rejected with an explanation. It is the last open slice of M-1. The Done rules are what make the forecast's "Done = finished at the base date" model exact, so they guard correctness, not only data hygiene.

## Starting Point

The forecast arithmetic already produces the PRD's US-04 dates (9, 6, 11, 8 Sep), and the Project aggregate's guardian (`TASK_CHECKS`/`PROJECT_CHECKS`) is built so new rules are list entries. Several pieces are still missing: no Done rule, no Status edit, and no way for `today` to reach the guardian. Import rejects any non-To-Do Status (`task-status-not-supported-yet`), and no view shows Status.

## Desired End State

Picking Done in the side panel marks the Task Done today in one edit, and a Completion date field allows backdating. Reverting a Done predecessor, adding a not-Done predecessor to a Done Task, or moving the START date past a completion date is rejected with a message naming the Task. Files with Statuses round-trip byte for byte, and the app writes file version `"1.0"`, the MVP schema, while still reading `"0.1"` files. The diagram shows Done and In Progress. When START's Tasks are Done the note says so, and an all-Done project shows its latest completion date as both Project Finish Dates.

## Key Decisions Made

| Decision                            | Choice                                                                                     | Why (1 sentence)                                                                                       | Source              |
| ----------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------- |
| How `today` reaches the rules       | `EditContext { today }` on every edit and door; hook reads the clock, tests inject it      | One rule location ("each Done rule id produced in exactly one function"), as the aggregate design says | Research / upstream |
| All-Done Project Finish Dates       | Both = latest completion date, note "Every Task is Done."                                  | Shows when the project actually finished and doesn't drift with the clock                              | Plan (roadmap Unk.) |
| Past START once its Tasks are Done  | New `baseDateReason` `start-successors-done` with a neutral note                           | The PRD says the START date no longer matters then; the oracle rows get a PRD-backed reason            | Plan (roadmap Unk.) |
| Highlight next to Done Tasks        | Remaining work only (may start mid-diagram); legend swatch hidden at 0 days                | Follows FR-010; no swatch for a highlight that isn't there                                             | Plan (roadmap Unk.) |
| Completion date with START unset    | No START bound                                                                             | Clearing START never fails on past work; forecast stays exact since base = today                       | Plan                |
| Completion date on a not-Done Task  | Leaving Done drops it; in a file it is a Validation Error (`completion-date-without-done`) | The model holds the date only where the PRD defines one; import stays lossless                         | Plan                |
| Marking Done                        | One edit: Done with completion date = today, then editable                                 | Atomic, no half-done state, one click for the common case                                              | Plan                |
| Diagram Status                      | Done (muted, check, "Done 2026-09-03") and In Progress marker, both in accessible names    | Progress visible at a glance; tests query nodes by name                                                | Plan                |
| Weekend completion dates (weekdays) | Allowed                                                                                    | No PRD rule forbids them and the forecast is unaffected                                                | Research            |
| File version                        | Bump `"0.1"` → `"1.0"` as the slice's last phase; read both; same key set                  | Marks the MVP file schema and closes M-1's version clause; `major.minor` matches the existing spelling | Plan (user)         |

## Scope

**In scope:**

- Seven new Validation Error rules in the guardian (five in `TASK_CHECKS`; the two predecessor rules in `PROJECT_CHECKS` after `cycle`, so a cycle is always reported first); `setStatus`, `setCompletionDate`
- `today` threaded through edits, `checkProject`, `toCheckedProject`, `validateProject`, `parseProjectFile`, `useProject`
- Import gate removed; `project-file-0.1-statuses.json` golden file
- Forecast reasons `all-tasks-done` and `start-successors-done`; US-04 oracle rows
- TaskPanel Status and Completion date; StartPanel and ForecastSummary notes; reworded withheld copy; swatch hidden at 0 days
- Diagram Status display with a new `--done` token; kitchen-sink states; one Playwright spec
- PRD, glossary, test-plan and roadmap updates
- Final step: file version `"1.0"` (export), reading `"0.1"` and `"1.0"`; `project-file-1.0.json` becomes the byte-for-byte golden file

**Out of scope:** any schema change in the version bump (no key added or removed), highlight bridging through Done Tasks, keeping a completion date after leaving Done, weekend rule for completion dates, multi-step Done UI, a third forecast kind, midnight re-render, FR-015/FR-018.

## Architecture / Approach

Rules live only in the guardian; edits address, parse and call `accept`; import's last stage is the same guardian. Indirect rejections therefore need no code in `setStartDate` or `addPredecessor`, only messages that name the Task they break. Phase 1 threads `today` as a behaviour-free refactor, so the rule phases read as rule entries and tests. The domain lands test-first (rules → import → forecast), then the hook and panels, then the diagram, then the browser check and docs, and finally the file version bump.

## Phases at a Glance

| Phase                                | What it delivers                                                          | Key risk                                                                |
| ------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1. Thread today through the guardian | `EditContext` everywhere, no behaviour change                             | Large mechanical diff across ~20 files                                  |
| 2. Done rules and Status edits       | 7 rules, 2 edits, US-04 rejection tests                                   | Check order (malformed START/predecessor dates) and message wording     |
| 3. Import lifts the Status gate      | Statuses round-trip; golden statuses file; a rejection row per rule       | Rewriting the stage-order test without its old pre-guardian limit       |
| 4. Progress-aware forecast           | `all-tasks-done`, `start-successors-done`; PRD oracle rows                | `addWeekdays` throws on a weekend completion date in the all-Done path  |
| 5. Session and panels                | Hook actions, Status select, Completion date field, notes, copy           | Completion-date draft going stale after a Status commit                 |
| 6. Diagram Status display            | Done/In Progress nodes and names, `--done` token, kitchen sink            | Done style distinguishable from warned/critical/selected in both themes |
| 7. Browser check and documentation   | Playwright "Done defaults to local today"; PRD/glossary/test-plan/roadmap | Clock and time-zone setup in e2e                                        |
| 8. Bump the file version to 1.0      | Export `"1.0"`, read `"0.1"` + `"1.0"`; MVP golden file; docs say `"1.0"` | Re-deriving the version rows; keeping every `0.1` golden file importing |

**Prerequisites:** S-03 and S-04 done (they are); branch `progress-aware-forecast`.
**Estimated effort:** ~4–6 sessions across 8 phases; Phases 1, 2 and 5 are the largest.

## Open Risks & Assumptions

- If the clock moves backwards (time-zone change mid-session), an unrelated edit can be rejected naming another Task's completion date. This is accepted per the upstream design §4.9, and the message names the Task.
- A file from someone whose today is ahead of the importer's is rejected as "after today", as the PRD requires.
- An older build rejects a `"1.0"` file as a newer version ("open it in a newer version of the app"). That's acceptable with a single deployed build.
- The roadmap and test plan said `"1"`; this plan uses `"1.0"` and Phase 8 updates them.

## Success Criteria (Summary)

- US-04 runs end to end in the built app: marking A Done moves both Project Finish Dates to the PRD's dates, and every listed rejection explains itself.
- No edit and no import can leave a project holding a Done-rule Validation Error, and the property test proves it.
- A project with In Progress and Done Tasks exports as version `"1.0"` and imports in another browser to exactly the same project; older `"0.1"` files still import.
