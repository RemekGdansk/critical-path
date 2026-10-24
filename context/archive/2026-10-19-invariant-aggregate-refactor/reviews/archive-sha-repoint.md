# Archive SHA repoint

## 2026-10-24

- **Target:** `origin/main` (git@github.com:RemekGdansk/critical-path.git), snapshot `cbc5b63c7cb20a573630239b975a520fbc3e7c82`
- **Integration commit:** `89f19c1ccf12a3137a2ee509e000088f24af7764` "Make the Project aggregate the one guardian of Validation Errors (#70)"
- **PR:** https://github.com/RemekGdansk/critical-path/pull/70 (merged into `main`, squash)
- **Evidence:** the PR commit list contains all five old SHAs; none is an ancestor of the target snapshot (complete, non-shallow history); `89f19c1` is. The squash diff (`89f19c1^..89f19c1`, 31 files, +1606/−234) equals the PR head `ee0b90d` diffed against its merge base, and the changed lines under `src/` are identical.
- **Decision:** the user chose "Update and archive" in `/10x-archive`.

| Row ID  | Old suffix (resolved OID)                                                            | New SHA |
| ------- | ------------------------------------------------------------------------------------ | ------- |
| 1.1–1.3 | 2e47fac (2e47fac — "Pin edit behaviour with a property test over edit sequences")    | 89f19c1 |
| 2.1–2.3 | b1a7816 (b1a7816 — "Check the Validation Error rules from one rule list")            | 89f19c1 |
| 3.1–3.6 | 0b06ea3 (0b06ea3 — "Check every edit's whole result in the Project guardian")        | 89f19c1 |
| 4.1–4.6 | 913852a (913852a — "Seal the session's entry points with CheckedProject")            | 89f19c1 |
| 5.1–5.6 | c6fccf6 (c6fccf6 — "Refuse createTask at the Task id limit in the Project guardian") | 89f19c1 |

Rows repointed: 24.
