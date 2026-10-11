---
type: log
date: 2026-10-11 13:45
author: jadon
tags: [area/backend, area/voice, area/dashboard, contract-change, decision]
---
# Verification code step removed for now (D6) #contract-change

- **Did:** decided to ship without the texted 6-digit code; behind `REQUIRE_VERIFICATION` (default false). Second Dial number added to the pool (`+16184644253` + `+15717200334`).
- **Others need to know:** MCP tools are now `lookup_caller`, `save_profile({name, consent})`, `triage_call` (+ `send_code`/`check_code` only when the flag is on). Pitch: "a phone number recognizes"; no "verified" claims on stage. Dashboard hides the Texted codes panel.
- **Files / endpoints touched:** server MCP + prompt template, `/api/me` `platform.requireVerification`, landing copy, dashboard.
- **Next:** deploy (Render + Vercel), register webhook + Context MCP, publish prompts, hello call.
