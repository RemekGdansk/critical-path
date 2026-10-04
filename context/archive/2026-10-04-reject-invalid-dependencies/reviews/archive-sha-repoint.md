# Archive SHA repoint

## 2026-10-04

- **Target**: origin/main, snapshot `643c0da256e3990db7fcb63624fd819db2789463` (fetched before archiving)
- **Integration commit**: `643c0da` — Reject cycle-closing predecessors with the cycle named (#36)
- **Association**: https://github.com/RemekGdansk/critical-path/pull/36. The PR was squash-merged, its merge commit is `643c0da`, and its commit list contains `efced48` and `46e5765`.
- **Evidence and scope**: `efced48` and `46e5765` are not ancestors of the target (`git merge-base --is-ancestor` exit 1, repository not shallow). The tree of `643c0da` is identical to the PR branch tip `0032447`. Its diff contains the phase 1 domain changes (`task-graph.ts`, `project.ts` and their tests) and the phase 2 picker, kitchen-sink and roadmap changes.
- **Decision**: the user chose "Update and archive".

| Row ID | Old suffix (resolved OID)                          | New SHA |
| ------ | -------------------------------------------------- | ------- |
| 1.1    | efced48 (efced489dedc01b30fd3d7a55f08d86c77eb7c0c) | 643c0da |
| 1.2    | efced48 (efced489dedc01b30fd3d7a55f08d86c77eb7c0c) | 643c0da |
| 1.3    | efced48 (efced489dedc01b30fd3d7a55f08d86c77eb7c0c) | 643c0da |
| 1.4    | efced48 (efced489dedc01b30fd3d7a55f08d86c77eb7c0c) | 643c0da |
| 2.1    | 46e5765 (46e576500829e082a016a73ece6293cd4dbda700) | 643c0da |
| 2.2    | 46e5765 (46e576500829e082a016a73ece6293cd4dbda700) | 643c0da |
| 2.3    | 46e5765 (46e576500829e082a016a73ece6293cd4dbda700) | 643c0da |
| 2.4    | 46e5765 (46e576500829e082a016a73ece6293cd4dbda700) | 643c0da |
| 2.5    | 46e5765 (46e576500829e082a016a73ece6293cd4dbda700) | 643c0da |
| 2.6    | 46e5765 (46e576500829e082a016a73ece6293cd4dbda700) | 643c0da |
| 2.7    | 46e5765 (46e576500829e082a016a73ece6293cd4dbda700) | 643c0da |
| 2.8    | 46e5765 (46e576500829e082a016a73ece6293cd4dbda700) | 643c0da |
| 2.9    | 46e5765 (46e576500829e082a016a73ece6293cd4dbda700) | 643c0da |
| 2.10   | 46e5765 (46e576500829e082a016a73ece6293cd4dbda700) | 643c0da |

Rows repointed: 14.
