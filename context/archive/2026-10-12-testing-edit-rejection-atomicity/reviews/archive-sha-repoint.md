# Archive SHA repoint

## 2026-10-13

- **Target**: `origin/main`, snapshot `b79badcc6eb6b2d4a560669a8d786cce0decbdbb`
- **Integration commit**: `b79badc` "Test that rejected edits leave planner state unchanged and warnings withhold the forecast (#55)"
- **PR**: https://github.com/RemekGdansk/critical-path/pull/55 (squash-merged into `main`)
- **Evidence**: the PR's commit list contains all three original SHAs (`2aa2087f8d9f79e87003d533adc4b06e4884b104`, `10cdd3b`, `6a56d7a`); none of them is an ancestor of the target snapshot (`git merge-base --is-ancestor` exit 1, full clone); `b79badc` has a tree identical to the branch tip `7ce866b` and covers all three phases (both test files, dev dependencies, test plan, `PROJECT_RULES.md`, change folder).
- **Decision**: the user chose "Update and archive".
- **Rows repointed**: 19

| Row ID  | Old suffix (resolved OID)                                              | New SHA   |
| ------- | ---------------------------------------------------------------------- | --------- |
| 1.1–1.8 | `2aa2087` (`2aa2087f8d9f79e87003d533adc4b06e4884b104`, Phase 1 commit) | `b79badc` |
| 2.1–2.8 | `10cdd3b` (`10cdd3b5e3feb68cf7250fd2c957d3631c480fcd`, Phase 2 commit) | `b79badc` |
| 3.1–3.3 | `6a56d7a` (`6a56d7a41073a45b43e2c5b909f30be40b9732d3`, Phase 3 commit) | `b79badc` |
