---
type: project
---
# Link — overview

**Stripe Link for phone support.** You explain your problem once, verify with an SMS code, and every later call to a Link-enabled company starts with the agent already knowing who you are and why you're calling. Urgent calls get a human first; nobody waits on hold.

Hackathon: SpeedHacks (a16z speedrun), Oct 11 2026. Challenge: "Give people their time back." Demos 9 PM.

## Demo must show (never cut)

1. A real phone call answered by the AI agent (Dial).
2. New caller verifies with a texted code and gets saved.
3. Returning caller greeted by name with their last issue.
4. Ranked callback queue with a "why ranked" reason and wait-time aging.

## Demo customer: a bank

Seed callers: a $10M account opening, a fraud-in-progress caller, a $12 duplicate-charge dispute. Pre-enroll two.

## Priority = urgency + value + waiting

Urgency first (fraud, lockout), value second, minutes waiting always adds points so small issues still get answered. See [[contracts#Scoring]].

## Sponsors

| Sponsor | Use | Status |
| --- | --- | --- |
| Dial | Phone number, AI voice, SMS codes, Context MCP, webhooks | Core |
| Keewano | Caller history store (fallback SQLite) | Stretch |
| Alike | Agent-to-agent brief handoff to reps | Stretch |
| Darwin | Make Link discoverable / intent routing | Stretch |

Full plan doc: https://claude.ai/code/artifact/61c98035-8e28-44b2-8a15-c8b1df6c6744
