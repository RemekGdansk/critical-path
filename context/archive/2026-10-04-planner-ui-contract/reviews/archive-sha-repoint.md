# Archive SHA repoint

## 2026-10-04

- **Target**: `origin/main` (the base of PR #35, confirmed with `git ls-remote --symref origin HEAD`) at snapshot `9a64d13d3cbd3f795f41023a8f255444010bc247`.
- **Integration**: PR #35, https://github.com/RemekGdansk/critical-path/pull/35. It was rebase-merged, so each branch commit was copied onto `main` as a new commit. There is no single merge commit; the head of the merge is `9a64d13` "Address the planner-ui-contract implementation review".
- **Evidence**:
  - The PR's commit list contains every old SHA.
  - None of them is an ancestor of the target (`git merge-base --is-ancestor`, exit 1, in a full clone).
  - Each old commit has exactly one commit on `main` with the same subject and an identical `git patch-id --stable`, and each of those is an ancestor of the target (exit 0).
- **Scope**: the six implementation commits of Phases 1–6. The plan close-out commit and the review-fix commit carry no Progress SHAs.
- **Decision**: the user chose "Update and archive" in `/10x-archive`.

| Row ID  | Old suffix (resolved OID)                              | New SHA   |
| ------- | ------------------------------------------------------ | --------- |
| 1.1–1.6 | `f45aa7d` (`f45aa7d1ee694bd9a2a5997d586552541ca7a3b4`) | `a6a8f5e` |
| 2.1–2.7 | `aeb0347` (`aeb03475d8702dd2ffece8de4d7291b4c9c9ea06`) | `4490f4c` |
| 3.1–3.9 | `2c06759` (`2c067591d00eba523a1d5a3128a15ffb1841548e`) | `15856d5` |
| 4.1–4.7 | `d212c61` (`d212c61ce0bf3b23ba3485cf8fa00357cfa0cae1`) | `afbcdd1` |
| 5.1–5.5 | `2ec3315` (`2ec3315646fd3c1539cec15eac906a9dd2c10ecd`) | `c4d807c` |
| 6.1–6.7 | `2da5121` (`2da5121a661a2e5c888bfd575a889e40590f69ad`) | `2541fe1` |

**Rows repointed**: 41.
