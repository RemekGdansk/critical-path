# Archive SHA repoint: capture-task-graph

## 2026-09-29

- **Target**: `origin/main` (resolved via `git ls-remote --symref origin HEAD`), snapshot `381a02d9b618fe40f83f822bb8a0bc81096aec08`; repository not shallow.
- **Integration commit**: `381a02d` "Capture Tasks and predecessors on an auto-arranged diagram (S-01) (#30)"
- **PR**: https://github.com/RemekGdansk/critical-path/pull/30 (base `main`, merged 2026-09-29T21:48:10Z as a squash)
- **Evidence**:
  - PR #30's commit list contains every old SHA: `c892f47`, `90260e2`, `15fd1c2`, `88f910b`, `e38b228`, `e16eef9`, `eacf530`, `4094bdf`, `e28c547`, `e452f79`, `b9349bb`.
  - Every old SHA resolves to a commit, and `git merge-base --is-ancestor <sha> 381a02d` exits 1 for each, so none of them is in `main`.
  - `git diff b9349bb 381a02d -- src astro.config.mjs` is empty, so the squash contains the whole implementation.
- **Decision**: the user chose "Update and archive" in `/10x-archive`.

| Row ID | Old suffix (resolved OID)                            | New SHA   |
| ------ | ---------------------------------------------------- | --------- |
| 1.1    | `15fd1c2` (15fd1c28a661999e3ee7238322677fdfe87e6c95) | `381a02d` |
| 1.2    | `15fd1c2` (15fd1c28a661999e3ee7238322677fdfe87e6c95) | `381a02d` |
| 1.3    | `15fd1c2` (15fd1c28a661999e3ee7238322677fdfe87e6c95) | `381a02d` |
| 1.4    | `15fd1c2` (15fd1c28a661999e3ee7238322677fdfe87e6c95) | `381a02d` |
| 2.1    | `e38b228` (e38b2288df4d1685bd0999d7c0610b14ddbc71c9) | `381a02d` |
| 2.2    | `e38b228` (e38b2288df4d1685bd0999d7c0610b14ddbc71c9) | `381a02d` |
| 3.1    | `eacf530` (eacf5302985e54b16daeef65da0a4ed6535e6458) | `381a02d` |
| 3.2    | `eacf530` (eacf5302985e54b16daeef65da0a4ed6535e6458) | `381a02d` |
| 4.1    | `e28c547` (e28c5470069683bbb86df8377928e9e480775052) | `381a02d` |
| 4.2    | `e28c547` (e28c5470069683bbb86df8377928e9e480775052) | `381a02d` |
| 4.3    | `e28c547` (e28c5470069683bbb86df8377928e9e480775052) | `381a02d` |
| 4.4    | `e28c547` (e28c5470069683bbb86df8377928e9e480775052) | `381a02d` |
| 4.5    | `e28c547` (e28c5470069683bbb86df8377928e9e480775052) | `381a02d` |
| 4.6    | `e28c547` (e28c5470069683bbb86df8377928e9e480775052) | `381a02d` |
| 4.7    | `e28c547` (e28c5470069683bbb86df8377928e9e480775052) | `381a02d` |
| 4.8    | `e28c547` (e28c5470069683bbb86df8377928e9e480775052) | `381a02d` |
| 4.9    | `e28c547` (e28c5470069683bbb86df8377928e9e480775052) | `381a02d` |
| 4.10   | `e28c547` (e28c5470069683bbb86df8377928e9e480775052) | `381a02d` |

Rows repointed: 18. In row 4.9 only the SHA token was replaced; the note after it is unchanged.
