---
type: reference
---
# Dial notes

Docs: https://docs.getdial.ai (append `.md` to any page for plain text).

## Commands

- Install: `curl -fsSL https://getdial.ai/install | bash` (Node 22+)
- Sign up: `dial auth login <email> --coupon <event code>` → `dial auth verify-otp --code <code> --agent claude-code`
- Health: `dial doctor`
- Inbound prompt: `dial number set <number> --inbound-instruction "..."`
- SMS: `dial message --to +1... --body "..."`
- Watch calls: `dial wait-for call.ended --field direction=inbound --json`
- Context MCP: `POST https://api.getdial.ai/v1/context-mcps` `{ "name": "link", "url": "<PUBLIC_URL>/mcp" }`

## Facts

- Every mid-call tool request carries `X-Dial-User-Number` (caller), `X-Dial-Agent-Number`, `X-Dial-Direction`.
- Events: `call.status_changed`, `call.ended`, `call.transcribed`, `message.received`. Use a webhook for guaranteed delivery.
- Free tier: 5-minute calls, 2 concurrent calls.
- `--forward-to` is a per-number setting, not a mid-call transfer.

## Gotchas

<!-- append: - <what happened> → <fix> (owner) -->
