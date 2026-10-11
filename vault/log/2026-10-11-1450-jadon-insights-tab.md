---
type: log
date: 2026-10-11 14:50
author: jadon
tags: [area/dashboard, area/stretch]
---
# Keewano Insights moved to its own tab

- **Did:** new `/insights` page (sidebar tab "Insights", "Powered by Keewano"): five tiles from `GET /api/insights` plus a "How this works" strip. Removed the Keewano card from the queue rail; Queue is live operations only again.
- **Others need to know:** run of show updated in [[project/demo-notes]]. New insight ids need a label in `web/src/pages/Insights.tsx` (`META`).
- **Files / endpoints touched:** `web/src/pages/Insights.tsx` (new), `web/src/components/Insights.tsx` (removed), `web/src/{App.tsx,pages/Queue.tsx,components/Shell.tsx,components/Icons.tsx,app.css}`.
- **Next:** none.
