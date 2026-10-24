# Archive SHA repoint

## 2026-10-24

- **Target:** `origin/main` (base of PR #67), snapshot `663ee9eb59b8956e608bde170dc28dba86913a7e`
- **Integration commit:** `3b309b7877245c8d87a1b3e20a505577ad2ea1ff` "Put the diagram libraries behind an anti-corruption layer (#67)"
- **PR:** https://github.com/RemekGdansk/critical-path/pull/67 (merged, squash)
- **Evidence:** none of the four Progress SHAs is an ancestor of the target snapshot; PR #67's commit list contains all four; `3b309b7` is an ancestor of the target, and its diff against its parent `99ac778` is identical to the PR diff from `99ac778` to its head `353bdec` (27 files).
- **Decision:** user chose "Update and archive" in `/10x-archive`.
- **Affected rows:** 23

| Row ID  | Old suffix (resolved OID)                                                                                        | New SHA   |
| ------- | ---------------------------------------------------------------------------------------------------------------- | --------- |
| 1.1–1.4 | `e7d1722` (`e7d1722b704f54efb77a05c57c819b50f7636f9b` "Move Duration helpers into duration.ts")                  | `3b309b7` |
| 2.1–2.6 | `c7b057f` (`c7b057fc7e62bcb880512000ad5605800d8520ba` "Add Diagram domain model, layout port and dagre adapter") | `3b309b7` |
| 3.1–3.9 | `7b1d479` (`7b1d4795d32f5ac7874cc880e051447ead3210f6` "Move React Flow into the diagram adapter directory")      | `3b309b7` |
| 4.1–4.4 | `639b48c` (`639b48cb8c24bbaee2926e5fb3e738475802aaad` "Fence diagram libraries with lint and record new names")  | `3b309b7` |
