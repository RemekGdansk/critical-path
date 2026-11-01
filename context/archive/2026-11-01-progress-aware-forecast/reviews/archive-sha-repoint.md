# Archive SHA repoint: progress-aware-forecast

## 2026-11-01

- **Target**: `origin/main` (remote default branch via `git ls-remote --symref origin HEAD`; PR #92 base `main`), snapshot `49ddad611f8834b2cdd9d77712150937eb0f111d`
- **Integration commit**: `49ddad6` "Add Task Statuses, completion dates and a progress-aware forecast (S-07) (#92)", a single-parent squash merge
- **PR**: https://github.com/RemekGdansk/critical-path/pull/92 (merged)
- **Evidence**: none of the eight Progress SHAs is an ancestor of the target snapshot (`git merge-base --is-ancestor` exit 1, full clone, not shallow); all eight are in PR #92's commit list; the squash commit's tree is identical to the PR branch head `e21b5fa` (`git diff e21b5fa 49ddad6` empty), so it integrates every phase's implementation (57 files: `src/`, `e2e/`, `context/`)
- **Decision**: the user chose "Update and archive"
- **Rows repointed**: 37

| Row ID  | Old suffix (resolved OID)                              | New SHA   |
| ------- | ------------------------------------------------------ | --------- |
| 1.1–1.6 | `666d1d4` (`666d1d492074af1662c4d8b111a0e1ec3df6ee63`) | `49ddad6` |
| 2.1–2.5 | `bd1e1b1` (`bd1e1b1e7dc7a5d22e4012bdcfc4f05f73b649e7`) | `49ddad6` |
| 3.1–3.4 | `9972c4b` (`9972c4bcb3633cd64194f6a8ad54ad9a768ac748`) | `49ddad6` |
| 4.1–4.3 | `e63716e` (`e63716e7f13ddbf4929afd4dcbabc9325cd0cb78`) | `49ddad6` |
| 5.1–5.5 | `dbf7266` (`dbf726635078ae5165ee62421e790e109aca2dcb`) | `49ddad6` |
| 6.1–6.4 | `4f68316` (`4f683163028a139f1e6dcb265f04572cfe875f05`) | `49ddad6` |
| 7.1–7.4 | `d875176` (`d875176b59ef7c105a81523ead84d488ae95958c`) | `49ddad6` |
| 8.1–8.6 | `576989f` (`576989fcf67a0e04399c323cace1f082e59cbcfd`) | `49ddad6` |
