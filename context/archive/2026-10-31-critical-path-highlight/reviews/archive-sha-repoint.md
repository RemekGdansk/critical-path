# Archive SHA repoint: critical-path-highlight

## 2026-10-31

- **Target**: `origin/main` (the base branch of PR #89), snapshot `7868b6450e3c913adea4d4aebf032138b2c79977`
- **Integration commit**: `7868b64` "Highlight the critical path and show remaining-work times (S-05) (#89)", a squash merge with a single parent, `34f564c`
- **PR**: https://github.com/RemekGdansk/critical-path/pull/89
- **Association**: the Progress SHAs were written before the branch was rebased onto S-08 (`34f564c`). The rebase rewrote them, so PR #89's commit list holds their rebased versions, and the user confirmed the mapping.
- **Evidence**:
  - `c8c26c1` → `5a29544`: identical `git patch-id --stable`.
  - `8ca685a` → `a48e4a1`: same subject and identical `git diff --numstat`. The patch-id differs only in diff context, which moved when the commit was rebased onto S-08's `Planner.test.ts`.
  - `9692b0f` → `83d36fd`: same subject. The only difference is `context/foundation/roadmap.md` (13 vs 12 changed lines), the rebase conflict resolution that kept S-08 `done`.
  - `83d36fd`, `a48e4a1` and `5a29544` are in PR #89's commit list.
  - `7868b64` has the same tree as the PR head `9b6eb91`: `git diff --quiet 9b6eb91 7868b64` exits 0.
  - `git merge-base --is-ancestor <old> origin/main` exits 1 for every old SHA.
  - `git merge-base --is-ancestor 7868b64 origin/main` exits 0.
- **Scope**: the whole implementation of Phases 1–3 (the remaining-work schedule and forecast, the critical path on the diagram, the remaining-work times in the header, tests, E2E and docs), plus the review fixes in `4bf87f2`, `b7f6cbd` and `9b6eb91`.
- **Decision**: the user chose "Update and archive".

| Row ID | Old suffix (resolved OID)                          | New SHA |
| ------ | -------------------------------------------------- | ------- |
| 1.1    | 9692b0f (9692b0f142134efdc065d945aac9f7ff5aa2e6e0) | 7868b64 |
| 1.2    | 9692b0f (9692b0f142134efdc065d945aac9f7ff5aa2e6e0) | 7868b64 |
| 1.3    | 9692b0f (9692b0f142134efdc065d945aac9f7ff5aa2e6e0) | 7868b64 |
| 1.4    | 9692b0f (9692b0f142134efdc065d945aac9f7ff5aa2e6e0) | 7868b64 |
| 2.1    | 8ca685a (8ca685abae48b44f9ece6588daaa84de63925458) | 7868b64 |
| 2.2    | 8ca685a (8ca685abae48b44f9ece6588daaa84de63925458) | 7868b64 |
| 2.3    | 8ca685a (8ca685abae48b44f9ece6588daaa84de63925458) | 7868b64 |
| 2.4    | 8ca685a (8ca685abae48b44f9ece6588daaa84de63925458) | 7868b64 |
| 2.5    | 8ca685a (8ca685abae48b44f9ece6588daaa84de63925458) | 7868b64 |
| 2.6    | 8ca685a (8ca685abae48b44f9ece6588daaa84de63925458) | 7868b64 |
| 3.1    | c8c26c1 (c8c26c1ee2b23b1971412b47614aaba8b3ab6d9f) | 7868b64 |
| 3.2    | c8c26c1 (c8c26c1ee2b23b1971412b47614aaba8b3ab6d9f) | 7868b64 |
| 3.6    | c8c26c1 (c8c26c1ee2b23b1971412b47614aaba8b3ab6d9f) | 7868b64 |
| 3.3    | c8c26c1 (c8c26c1ee2b23b1971412b47614aaba8b3ab6d9f) | 7868b64 |
| 3.4    | c8c26c1 (c8c26c1ee2b23b1971412b47614aaba8b3ab6d9f) | 7868b64 |
| 3.5    | c8c26c1 (c8c26c1ee2b23b1971412b47614aaba8b3ab6d9f) | 7868b64 |

Rows repointed: 16.
