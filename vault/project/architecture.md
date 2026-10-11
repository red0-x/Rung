---
type: project
---
# Architecture

```mermaid
flowchart LR
  Caller -- voice --> Dial
  Dial -- "mid-call tools (X-Dial-User-Number)" --> Backend[Rung backend: MCP + API]
  Dial -- "webhooks: call.ended, call.transcribed" --> Backend
  Backend -- "SMS code" --> Dial
  Backend <--> DB[(Supabase Postgres)]
  Backend -- "/api/queue" --> Dashboard[Rung dashboard on Vercel]
  Dashboard --> Rep[Human rep] -- calls back --> Caller
  Backend -. stretch .-> Alike
```

- **Dial** does all telephony: answers, talks, sends SMS. We configure it, we don't build it. See [[dial]].
- **Rung backend** is the one service we write: MCP server + webhook receiver + small JSON API. One process, one port.
- **Dashboard** polls `/api/queue` every 1.5 s with the user's Supabase token. No websockets, never reads tables directly.
- **Callbacks, not transfers**: Dial can't hand a live call to a human mid-call, so the agent ends the call with an ETA and a rep calls back.

Areas: [[areas/voice]] · [[areas/backend]] · [[areas/dashboard]] · [[areas/stretch]]
