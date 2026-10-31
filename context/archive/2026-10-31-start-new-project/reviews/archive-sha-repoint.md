# Archive SHA repoint: start-new-project

## 2026-10-31

- **Target**: `origin/main` (the base branch of PR #87), snapshot `6cfa6d119719733d9d07d381a8606cb5520de97c`
- **Integration commit**: `6cfa6d1` "Start a new project safely (S-08) (#87)", a squash merge with a single parent, `7cea67e`
- **PR**: https://github.com/RemekGdansk/critical-path/pull/87
- **Evidence**:
  - The PR's commit list contains every old SHA below.
  - `6cfa6d1` has the same tree as the PR head `7e289b2`: `git diff --quiet 7e289b2 6cfa6d1` exits 0.
  - `git merge-base --is-ancestor <old> origin/main` exits 1 for every old SHA.
  - `git merge-base --is-ancestor 6cfa6d1 origin/main` exits 0.
- **Scope**: the whole implementation of Phases 1–4 (the hook rule, `ConfirmDialog`, the New project, Import and Go back confirmations, tests, E2E and docs), plus the review fixes in `7e289b2`.
- **Decision**: the user chose "Update and archive". The first archive commit had kept the old SHAs because of a faulty ancestry check (it read `$?` after a command substitution). The archive commit was amended before it reached `main`.

| Row ID | Old suffix (resolved OID)                          | New SHA |
| ------ | -------------------------------------------------- | ------- |
| 1.1    | 2d02434 (2d02434cf44125ea9247bbbcfa7480ab12b89df7) | 6cfa6d1 |
| 1.2    | 2d02434 (2d02434cf44125ea9247bbbcfa7480ab12b89df7) | 6cfa6d1 |
| 1.3    | 2d02434 (2d02434cf44125ea9247bbbcfa7480ab12b89df7) | 6cfa6d1 |
| 2.1    | 9ce43a9 (9ce43a9f1f6c54cb917533d6c704611f5ebb445a) | 6cfa6d1 |
| 2.2    | 9ce43a9 (9ce43a9f1f6c54cb917533d6c704611f5ebb445a) | 6cfa6d1 |
| 2.3    | 9ce43a9 (9ce43a9f1f6c54cb917533d6c704611f5ebb445a) | 6cfa6d1 |
| 2.4    | 9ce43a9 (9ce43a9f1f6c54cb917533d6c704611f5ebb445a) | 6cfa6d1 |
| 2.5    | 9ce43a9 (9ce43a9f1f6c54cb917533d6c704611f5ebb445a) | 6cfa6d1 |
| 2.6    | 9ce43a9 (9ce43a9f1f6c54cb917533d6c704611f5ebb445a) | 6cfa6d1 |
| 3.1    | 4d85e31 (4d85e319a3e3fc05f1b0406b91f55827743ef0a3) | 6cfa6d1 |
| 3.2    | 4d85e31 (4d85e319a3e3fc05f1b0406b91f55827743ef0a3) | 6cfa6d1 |
| 3.3    | 4d85e31 (4d85e319a3e3fc05f1b0406b91f55827743ef0a3) | 6cfa6d1 |
| 3.4    | 4d85e31 (4d85e319a3e3fc05f1b0406b91f55827743ef0a3) | 6cfa6d1 |
| 4.1    | 871431d (871431d30615c8d79577251c0b126d0338ef4a4f) | 6cfa6d1 |
| 4.2    | 871431d (871431d30615c8d79577251c0b126d0338ef4a4f) | 6cfa6d1 |
| 4.3    | 871431d (871431d30615c8d79577251c0b126d0338ef4a4f) | 6cfa6d1 |
| 4.4    | 871431d (871431d30615c8d79577251c0b126d0338ef4a4f) | 6cfa6d1 |
| 4.5    | 871431d (871431d30615c8d79577251c0b126d0338ef4a4f) | 6cfa6d1 |
| 4.6    | 871431d (871431d30615c8d79577251c0b126d0338ef4a4f) | 6cfa6d1 |

Rows repointed: 19.
