# Archive SHA repoint

## 2026-10-11

- **Target**: `origin/main` (github.com/RemekGdansk/critical-path), snapshot `82cb32e1a1f478f07ae922959f06bc71c9afd06d`, fetched fresh; repository not shallow.
- **Integration commit**: `82cb32e` "Built-artifact CSP check (#44)", the squash merge of https://github.com/RemekGdansk/critical-path/pull/44 (base `main`, state MERGED).
- **Evidence**: PR #44's commit list holds all three old SHAs (`0a24e2b f6593d3 bfcf6ff d452a2c 8507bc0 a2335e2 ab57eac a74a6a7 e55e7db a317242`); `82cb32e`'s parent is the PR's branch point `2b978a6`, and its tree is identical to the PR head `a317242` (`git diff --quiet a317242 82cb32e` exits 0). Each old SHA resolves to a commit and is not an ancestor of the target (`merge-base --is-ancestor` exit 1); `82cb32e` is (exit 0).
- **Decision**: user chose "Update and archive".

| Row ID   | Old suffix (resolved OID)                              | New SHA   |
| -------- | ------------------------------------------------------ | --------- |
| 1.1–1.12 | `f6593d3` (`f6593d33a469fa7148680845c38b2a2a4d438591`) | `82cb32e` |
| 2.1–2.7  | `d452a2c` (`d452a2c20ad3f32d9d46358f570071015986ff40`) | `82cb32e` |
| 3.1–3.5  | `a74a6a7` (`a74a6a7707d6969d7142da2e1350ad2641fe32c4`) | `82cb32e` |

Rows repointed: 24.
