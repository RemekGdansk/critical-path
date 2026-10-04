# Archive SHA repoint

## 2026-10-05

- **Target**: origin/main, snapshot `a206c01595edfca42b5aa80ae6129a00b6e09cd2` (fetched before archiving)
- **Integration commit**: `a206c01` — Forecast Resource-Unconstrained and Resource-Constrained Project Finish Dates (#37)
- **Association**: https://github.com/RemekGdansk/critical-path/pull/37. The PR was squash-merged and its merge commit is `a206c01`. The Progress SHAs predate a rebase onto S-02 (`6965785`): `git range-diff 5231325..52afdd6 891a8cc..8673b47` pairs `17f54a3` → `b11107d`, `a055fe7` → `83a952b` and `52afdd6` → `8673b47` (changed by conflict resolution), and those three are in the PR's commit list.
- **Evidence and scope**: `17f54a3`, `a055fe7` and `52afdd6` are not ancestors of the target (`git merge-base --is-ancestor` exit 1, repository not shallow). The tree of `a206c01` is identical to the PR branch tip `f47afb7`. Its diff contains the phase 1 domain (`calendar-date.ts`, `forecast.ts`, `validation-warnings.ts`, `project.ts`, `task-graph.ts` and their tests), the phase 2 editing UI (`StartPanel.tsx`, `TaskPanel.tsx`, `Diagram.tsx`, `useProject.ts`) and the phase 3 display (`ForecastSummary.tsx`, `TaskNode.tsx`, `global.css`, fixtures).
- **Decision**: the user chose "Update and archive".

| Row ID | Old suffix (resolved OID)                          | New SHA |
| ------ | -------------------------------------------------- | ------- |
| 1.1    | 17f54a3 (17f54a3ff9529d79566823b4a5b9d202e8a5f999) | a206c01 |
| 1.2    | 17f54a3 (17f54a3ff9529d79566823b4a5b9d202e8a5f999) | a206c01 |
| 1.3    | 17f54a3 (17f54a3ff9529d79566823b4a5b9d202e8a5f999) | a206c01 |
| 2.1    | a055fe7 (a055fe783b4b2f12f6aa9cbb32a25de62ae83a79) | a206c01 |
| 2.2    | a055fe7 (a055fe783b4b2f12f6aa9cbb32a25de62ae83a79) | a206c01 |
| 2.3    | a055fe7 (a055fe783b4b2f12f6aa9cbb32a25de62ae83a79) | a206c01 |
| 2.4    | a055fe7 (a055fe783b4b2f12f6aa9cbb32a25de62ae83a79) | a206c01 |
| 2.5    | a055fe7 (a055fe783b4b2f12f6aa9cbb32a25de62ae83a79) | a206c01 |
| 2.6    | a055fe7 (a055fe783b4b2f12f6aa9cbb32a25de62ae83a79) | a206c01 |
| 2.7    | a055fe7 (a055fe783b4b2f12f6aa9cbb32a25de62ae83a79) | a206c01 |
| 3.1    | 52afdd6 (52afdd6b99e6d1df90ff675ad41998a13036e22f) | a206c01 |
| 3.2    | 52afdd6 (52afdd6b99e6d1df90ff675ad41998a13036e22f) | a206c01 |
| 3.3    | 52afdd6 (52afdd6b99e6d1df90ff675ad41998a13036e22f) | a206c01 |
| 3.4    | 52afdd6 (52afdd6b99e6d1df90ff675ad41998a13036e22f) | a206c01 |
| 3.5    | 52afdd6 (52afdd6b99e6d1df90ff675ad41998a13036e22f) | a206c01 |
| 3.6    | 52afdd6 (52afdd6b99e6d1df90ff675ad41998a13036e22f) | a206c01 |
| 3.7    | 52afdd6 (52afdd6b99e6d1df90ff675ad41998a13036e22f) | a206c01 |
| 3.8    | 52afdd6 (52afdd6b99e6d1df90ff675ad41998a13036e22f) | a206c01 |
| 3.9    | 52afdd6 (52afdd6b99e6d1df90ff675ad41998a13036e22f) | a206c01 |
| 3.10   | 52afdd6 (52afdd6b99e6d1df90ff675ad41998a13036e22f) | a206c01 |

Rows repointed: 20.
