---
type: log
date: 2026-10-11 14:40
author: jadon
tags: [area/dashboard, area/stretch]
---
# Keewano Insights card on the queue page

- **Did:** added the "Last 24 h · Keewano" card at the top of the queue page's right column. It reads `GET /api/insights` every 60 s, ↻ sends `?refresh=1`. Shows all 5 items, including red's `context_saved` and `eta_text`. Hidden when Keewano is off.
- **Others need to know:** demo run of show for Keewano is in [[project/demo-notes]]. Use it for the pitch outline. New insight ids need a label in `web/src/components/Insights.tsx` (`TITLE`, plus `ROWS` if the answer is "label n · label n").
- **Files / endpoints touched:** `web/src/components/Insights.tsx` (new), `web/src/pages/Queue.tsx`, `web/src/api.ts`, `web/src/types.ts`, `web/src/components/Icons.tsx`, `web/src/app.css`.
- **Next:** real calls ~15 min before the demo so the counts are fresh.
