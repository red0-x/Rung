---
type: log
date: 2026-10-11 21:35
author: red
tags: [area/voice, area/backend, area/dashboard]
---
# Faster intake, recognized-caller greeting, structured rep brief

- **Did:** (1) Saved callers hear "Hi Maria, I've got your details up. What can I help you with today?" and are not quizzed about their last issue (an open request is still announced). (2) Intake: one open question, then only what is still missing (what/how much, when, tried/wants), max 3 questions, urgent calls max 1, then a one-line read-back before queueing. (3) The brief the agent writes is now a fixed shape: headline under 20 words, then `When:`, `Tried:`, `Wants:`, optional `Best time:`. The dashboard Issue field shows each on its own line (`white-space: pre-line`).
- **Others need to know:** prompt template changed, so republish each org's prompt after the deploy. No schema or tool shape change. Greeting wording lives in `lookup_caller` guidance (`server/src/mcp.ts`) and `docs/inbound-prompt.md`.
- **Files / endpoints touched:** `server/src/mcp.ts`, `docs/inbound-prompt.md`, `web/src/app.css`, `server/test/caller-context.test.ts` (108 tests green).
- **Next:** real-call check that the agent actually follows the shape; if reps want it scannable at a glance, the queue row could show only the headline line.
