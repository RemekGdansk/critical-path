# Archive SHA repoint

## 2026-09-26

- **Target:** `origin` / `main`, snapshot `07bdc842139110a616ab2a123bcfb895a3904fa2` (fetched fresh; full clone)
- **Integration commit:** `07bdc84` "Add domain-rule verification gate (F-01) (#24)"
- **Association:** https://github.com/RemekGdansk/critical-path/pull/24, squash merged into `main`; its commit list contains `98ec09e` and `17251af`
- **Evidence:** `git merge-base --is-ancestor` returned 1 for `98ec09e` and `17251af` against the snapshot; `git diff 92c7b81 07bdc84` (PR head vs merge commit) is empty, so the squash carries the whole implementation: Vitest config and smoke test, Tailwind exclusion, `ci.yml` test step, project docs and `deploy-plan.md`
- **Decision:** user chose "Update and archive"

| Row ID | Old suffix (resolved OID)                              | New SHA   |
| ------ | ------------------------------------------------------ | --------- |
| 1.1    | `98ec09e` (`98ec09e710aa9a8ff8f575426429497789b61995`) | `07bdc84` |
| 1.2    | `98ec09e` (`98ec09e710aa9a8ff8f575426429497789b61995`) | `07bdc84` |
| 1.3    | `98ec09e` (`98ec09e710aa9a8ff8f575426429497789b61995`) | `07bdc84` |
| 1.4    | `98ec09e` (`98ec09e710aa9a8ff8f575426429497789b61995`) | `07bdc84` |
| 1.5    | `98ec09e` (`98ec09e710aa9a8ff8f575426429497789b61995`) | `07bdc84` |
| 1.6    | `98ec09e` (`98ec09e710aa9a8ff8f575426429497789b61995`) | `07bdc84` |
| 1.7    | `98ec09e` (`98ec09e710aa9a8ff8f575426429497789b61995`) | `07bdc84` |
| 1.8    | `98ec09e` (`98ec09e710aa9a8ff8f575426429497789b61995`) | `07bdc84` |
| 1.9    | `98ec09e` (`98ec09e710aa9a8ff8f575426429497789b61995`) | `07bdc84` |
| 2.1    | `17251af` (`17251af758575c24a731c4b1d4ad8b1c3f2b9572`) | `07bdc84` |
| 2.2    | `17251af` (`17251af758575c24a731c4b1d4ad8b1c3f2b9572`) | `07bdc84` |
| 2.3    | `17251af` (`17251af758575c24a731c4b1d4ad8b1c3f2b9572`) | `07bdc84` |
| 2.4    | `17251af` (`17251af758575c24a731c4b1d4ad8b1c3f2b9572`) | `07bdc84` |
| 2.5    | `17251af` (`17251af758575c24a731c4b1d4ad8b1c3f2b9572`) | `07bdc84` |

Rows repointed: 14. Row 2.6 already carried `07bdc84` and was not changed.
