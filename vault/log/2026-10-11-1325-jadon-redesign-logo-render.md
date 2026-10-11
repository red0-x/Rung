---
type: log
date: 2026-10-11 13:25
author: jadon
tags: [area/dashboard, area/backend]
---
# Dashboard redesign, B2B landing, real logo, Render blueprint

- **Did:** landing repositioned as B2B ("For customer support teams"; your team / your customers); call → queue animation. Dashboard redesigned from `attachments/dash-ref-*.png`: ink sidebar, greeting, 4 stat tiles, ranked list + caller brief, Today timeline, texted codes, "How ranking works" drawer, `/callers`. Logo vectorized from the brand sheet → `web/src/brand/Logo.tsx`, favicon. `render.yaml` for the server.
- **Others need to know:** use `<Logo />` for any new UI; don't draw the wordmark by hand. Keyboard on `/queue`: ↑/↓ select, Enter = Call back. Server host = Render (one instance; use a non-sleeping plan for the demo).
- **Files / endpoints touched:** `web/`, `render.yaml`, `attachments/dash-ref-*.png`.
- **Next:** Render deploy (needs human sign-in), Vercel deploy of `web/`, then `docs/GO_LIVE.md`.
