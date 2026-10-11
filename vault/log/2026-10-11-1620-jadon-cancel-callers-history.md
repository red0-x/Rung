---
type: log
date: 2026-10-11 16:20
author: jadon
tags: [area/dashboard, area/backend, contract-change]
---
# Cancel callback, Reopen, Callers + History tables, queue redesign #contract-change

- **Did:** API v3.1 (`docs/API.md`): `POST /api/queue/:id/release` (cancel callback, keeps place), `POST /api/queue/:id/reopen`, `GET /api/callers`, `GET /api/history`. Dashboard: queue rows + brief per `attachments/queue-ref-patients.png`; Callers/History per `attachments/callers-ref-rows.png`; UX pass (focus, Esc, loading states). Trust never shows "verified" while codes are off. 98 tests; live on prod.
- **Others need to know:** frontend teammate: these touched `web/src/pages/Queue.tsx`, `Callers.tsx`, `components/{QueueRow,Detail,Rail,Icons,Toast}.tsx`, `app.css`, `api.ts`, `types.ts`. Pull before editing those.
- **Files / endpoints touched:** `server/src/app.ts`, stores, `web/`.
- **Next:** logos for Bank of Antarctica / Mango Clinic; clear test callers before the demo.
