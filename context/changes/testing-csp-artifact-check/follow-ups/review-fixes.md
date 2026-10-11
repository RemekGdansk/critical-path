# Review fixes — testing-csp-artifact-check

Queued from `reviews/impl-review-phase-1.md`.

## From Phase 1 review

- **F2 → Phase 3 (test-plan §6.4):** describe how the checker reports, so the next artifact check follows the same shape: one violation per offending item (not one per rule), each line `<page>: rule N (short name): <directive/token/element>`. Also note that rule 7 is deliberately stricter than its oracle wording: it scans `<template>` content, treats `\\` and `/\` like `//`, and strips tabs and newlines before matching.
- **F1 (already fixed in code) → Phase 3 (test-plan §6.4):** the cookbook's statement of the oracle must include the widened rule 6 (`<style>` and `style` attributes before the meta) and `imagesrcset` in rule 7, per the oracle addendum in `plan.md`.
