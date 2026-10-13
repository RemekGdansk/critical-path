# Archive SHA repoint

## 2026-10-14

- **Target**: `origin/main` @ `8e0bba653178e725f0a12854ac79739c800a598a` (fetched before the archive)
- **Integration commit**: `8e0bba6` "Recover from render crashes with a fallback that keeps the project exportable (#59)"
- **PR**: https://github.com/RemekGdansk/critical-path/pull/59 (merged into `main` as a squash)
- **Evidence**: PR #59's commit list contains `23b4b45`, `1192a9d` and `751427c`. None of the three is an ancestor of the target. The squash commit's tree is identical to the PR head `4ab6954` (`git diff 4ab6954 8e0bba6` is empty), so it integrates the whole implementation: `src/hooks/useProject.ts`, `src/components/planner/` and `e2e/render-crash.spec.ts`, among others.
- **Decision**: the user chose "Update and archive" on 2026-10-14.
- **Rows repointed**: 14

| Row ID  | Old suffix (resolved OID)                                             | New SHA   |
| ------- | --------------------------------------------------------------------- | --------- |
| 1.1–1.3 | `23b4b45` ("Remember the previous project in useProject")             | `8e0bba6` |
| 2.1–2.6 | `1192a9d` ("Show a crash fallback that keeps the project exportable") | `8e0bba6` |
| 3.1–3.5 | `751427c` ("Prove render crash recovery in the built app")            | `8e0bba6` |
