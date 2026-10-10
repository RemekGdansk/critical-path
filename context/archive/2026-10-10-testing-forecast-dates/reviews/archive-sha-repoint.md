# Archive SHA repoint

## 2026-10-10

- **Target**: origin/main, snapshot `ce58176b66ea2245120dd0908efd430e6005339f` (fetched before archiving)
- **Integration commit**: `ce58176` — Testing forecast dates (#43)
- **Association**: https://github.com/RemekGdansk/critical-path/pull/43. The PR was squash-merged into `main` and its merge commit is `ce58176`. All four Progress SHAs (`8447836`, `b0b0fdc`, `b3169ae`, `ffebf2a`) are in the PR's commit list.
- **Evidence and scope**: none of the four is an ancestor of the target (`git merge-base --is-ancestor` exit 1, repository not shallow). The tree of `ce58176` is identical to the PR branch tip `9f2188b`. Its diff contains phase 1 (`vitest.config.ts`, `calendar-date.test.ts`), phase 2 (`forecast.test.ts`), phase 3 (`ForecastSummary.test.ts`) and phase 4 (`test-plan.md`, `roadmap.md`, `PROJECT_RULES.md`).
- **Decision**: the user chose "Update and archive".

| Row ID | Old suffix (resolved OID)                          | New SHA |
| ------ | -------------------------------------------------- | ------- |
| 1.1    | 8447836 (8447836dcce5a953421373f3a0e64ef722830a6d) | ce58176 |
| 1.2    | 8447836 (8447836dcce5a953421373f3a0e64ef722830a6d) | ce58176 |
| 1.3    | 8447836 (8447836dcce5a953421373f3a0e64ef722830a6d) | ce58176 |
| 1.4    | 8447836 (8447836dcce5a953421373f3a0e64ef722830a6d) | ce58176 |
| 2.1    | b0b0fdc (b0b0fdc0405bb6f385247c7ea62dba892c410d89) | ce58176 |
| 2.2    | b0b0fdc (b0b0fdc0405bb6f385247c7ea62dba892c410d89) | ce58176 |
| 2.3    | b0b0fdc (b0b0fdc0405bb6f385247c7ea62dba892c410d89) | ce58176 |
| 2.4    | b0b0fdc (b0b0fdc0405bb6f385247c7ea62dba892c410d89) | ce58176 |
| 3.1    | b3169ae (b3169aeac6b4c87820cb4de86880b8e0ca90bffd) | ce58176 |
| 3.2    | b3169ae (b3169aeac6b4c87820cb4de86880b8e0ca90bffd) | ce58176 |
| 3.3    | b3169ae (b3169aeac6b4c87820cb4de86880b8e0ca90bffd) | ce58176 |
| 3.4    | b3169ae (b3169aeac6b4c87820cb4de86880b8e0ca90bffd) | ce58176 |
| 4.1    | ffebf2a (ffebf2ab88f95c606a9b26688e5c2db163c7e64b) | ce58176 |
| 4.2    | ffebf2a (ffebf2ab88f95c606a9b26688e5c2db163c7e64b) | ce58176 |
| 4.3    | ffebf2a (ffebf2ab88f95c606a9b26688e5c2db163c7e64b) | ce58176 |
| 4.4    | ffebf2a (ffebf2ab88f95c606a9b26688e5c2db163c7e64b) | ce58176 |

Total: 16 rows repointed.
