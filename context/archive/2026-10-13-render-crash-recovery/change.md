---
change_id: render-crash-recovery
title: Recover from render crashes with an error boundary that keeps the project exportable
status: archived
created: 2026-10-13
updated: 2026-10-14
archived_at: 2026-10-13T22:41:47Z
---

## Notes

lift the project state above an error boundary so a render throw shows the error and offers "Export the project as it was" instead of blanking the page (audit 2026-10-13, findings B1, A1, C1)
