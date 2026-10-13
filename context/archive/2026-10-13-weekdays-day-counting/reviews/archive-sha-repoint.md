# Archive SHA repoint: weekdays-day-counting

- **Date**: 2026-10-13
- **Target**: `origin/main`, snapshot `040538cfd317b167adc842b179ba496ec704c798`
- **Integration commit**: `040538c` "Add weekdays day counting (S-06) (#56)"
- **PR**: https://github.com/RemekGdansk/critical-path/pull/56 (merged into `main` as a squash)
- **Evidence**: the PR's commit list holds `7c58e8b`, `ba74560` and `fa8d592`, and none of them is an ancestor of the target (`git merge-base --is-ancestor` exit 1). `040538c` is in the target history (exit 0). Its tree is identical to the PR's tip `4aa0956` (`git diff 4aa0956 040538c` is empty), so it integrates all three phases' code.
- **Decision**: the user chose "Update and archive".

| Row ID | Old suffix (resolved OID) | New SHA |
| ------ | ------------------------- | ------- |
| 1.1    | 7c58e8b                   | 040538c |
| 1.2    | 7c58e8b                   | 040538c |
| 1.3    | 7c58e8b                   | 040538c |
| 1.4    | 7c58e8b                   | 040538c |
| 2.1    | ba74560                   | 040538c |
| 2.2    | ba74560                   | 040538c |
| 2.3    | ba74560                   | 040538c |
| 2.4    | ba74560                   | 040538c |
| 3.1    | fa8d592                   | 040538c |
| 3.2    | fa8d592                   | 040538c |
| 3.3    | fa8d592                   | 040538c |
| 3.4    | fa8d592                   | 040538c |
| 3.5    | fa8d592                   | 040538c |
| 3.6    | fa8d592                   | 040538c |

Rows repointed: 14.
