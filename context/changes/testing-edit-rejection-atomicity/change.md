---
change_id: testing-edit-rejection-atomicity
title: Test that rejected edits leave planner state unchanged and warnings withhold the forecast
status: impl_reviewed
created: 2026-10-12
updated: 2026-10-12
archived_at: null
---

## Notes

Open a change folder for rollout Phase 2 of context/foundation/test-plan.md: "Edit-rejection atomicity".
Risks covered: #5 (an edit rejected as a Validation Error still leaves the planner's state partly changed, or shown as changed); #6 (a Project Finish Date, or a stale one, stays visible while a Validation Warning exists). Test types planned: integration (hook, DOM env).
Risk response intent:

- #5: for each rejected edit kind, planner state after the rejection equals state before it, and the message names the rule; challenge "the domain returned an error, so state is untouched"; avoid mocking the domain layer inside the hook test.
- #6: with a not-Done Task missing a Duration, neither Project Finish Date nor the remaining-work times render, and both reappear once it is fixed; challenge "the forecast returns nothing, so the UI hides it" (a stale or memoized value may still show); avoid asserting only the domain return value.

After creating the folder, follow the downstream continuation rule.
