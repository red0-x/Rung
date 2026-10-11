---
type: log
date: 2026-10-11 23:30
author: jadon
tags: [area/stretch, area/backend]
---
# Pitch run sheet, demo reset script, $10M demo account → $200K

- **Did:** 3-speaker run sheet (Jadon host, Reid caller, Conrad rep): https://claude.ai/artifact/Sc8C2fCNUFo2AyZkgF73cT. Hold video `docs/pitch-assets/on-hold.mp4`. `npm run demo:reset` puts the bank's 3 demo calls back in the queue (Maria 4 min, James 7, Sam 12 waiting) straight in Supabase, so it works on prod. Demo account opening is now $200K (score 52), not $10M: landing MiniQueue, simulate script, live James row, docs.
- **Others need to know:** pricing in the pitch is 30¢ per AI minute (not $49/seat, which couldn't cover the $0.22/min Dial bill). Reid's live call should be a fraud-type issue so it ranks above James. Run `demo:reset` within 10 min of going live, then Forget caller on Reid's number.
- **Files / endpoints touched:** `scripts/demo-reset.mjs`, `package.json`, `scripts/simulate-call.ts`, `web/src/landing/MiniQueue.tsx`, `docs/{pitch.md,GO_LIVE.md,pitch-assets/}`, `vault/project/{contracts,overview}.md`.
- **Next:** team credibility lines; rehearse twice with a timer.
