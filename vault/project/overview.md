---
type: project
---
# Rung — overview

**Gmail Priority Inbox for phone support** (D10; was "Stripe Link for phone support"). You explain your problem once, and every later call to a Rung-enabled company starts with the agent already knowing who you are and why you're calling. Urgent calls get a human first; nobody waits on hold.

**B2B.** We sell to businesses that want to streamline phone support. Their calls arrive filtered, ranked, and with a brief before a rep calls back; their customers never hold, they get called back. Pitch both sides: time back for the support team *and* for the customer.

Tagline: **"Never on hold. Never a stranger."** (D10; replaces "Your time, returned.") Pitch script: `docs/pitch.md`.

**Multi-company (D5):** many companies, each with its own Rung (own Dial number, rules, callers, queue). A company signs in to the dashboard, sets up its Rung in `/setup`, and works its queue in `/queue`. Spec: `attachments/RUNG_CONTEXT.md`.

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
| Darwin | Make Rung discoverable / intent routing | Stretch |

Full plan doc: https://claude.ai/code/artifact/61c98035-8e28-44b2-8a15-c8b1df6c6744
