---
type: area
owner: 
---
# Area: dashboard

Rep view of the queue. Reads `GET /api/queue` ([[project/contracts#HTTP API (backend)]]); until backend is up, mock that exact shape.

## Status
- [x] `/` landing (hero, phone, fragment collage, before/after) — 2026-10-11
- [x] `/login` (Supabase Auth sign-in/up, dev sign-in in dev only)
- [x] `/queue` ranked ledger: FLIP reorder, score bars, live clocks, Call back / Done, transcripts, time-saved counter, Texted codes panel, Rules panel; polls 1.5 s
- [x] `/setup` wizard: company, greeting/tone, rules, claim number, live prompt preview, Publish to Dial, MCP URL
- [x] Verified against the real server + Supabase (bank demo user via dev token)
- [ ] Deploy to Vercel (`VITE_API_BASE` = server URL)

## Requests
