---
type: area
owner: 
---
# Area: dashboard

Rep view of the queue. Reads `GET /api/queue` ([[project/contracts#HTTP API (backend)]]); until backend is up, mock that exact shape.

## Status
- [ ] Queue list sorted by score, polls every 2 s
- [ ] Each row: name, category, amount, `reason`, waited time, brief
- [ ] Call back button (`tel:` link) → `POST /api/calls/:id/status`
- [ ] Readable on a projector

## Requests
