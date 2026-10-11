---
type: log
date: 2026-10-11 22:15
author: jadon
tags: [area/backend, area/dashboard, contract-change]
---
# Forget caller (admin) for fresh test calls #contract-change

- **Did:** Callers page → row menu → **Forget caller…** (admins only, confirm drawer). `DELETE /api/callers/:key` deletes that number's profile, verification and every queue item + transcript at this org only. Next call from the number is a first call. Contracts v6; closes caller-context gap 8. 131 tests.
- **Others need to know:** use this between test calls instead of `/api/dev/reset` (which wipes the whole org). Analytics events already sent to Keewano are not recalled.
- **Files / endpoints touched:** `server/src/app.ts`, stores, `web/src/pages/Callers.tsx`, `api.ts`, `app.css`, `docs/API.md`.
