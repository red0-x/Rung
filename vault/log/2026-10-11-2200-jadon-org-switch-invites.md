---
type: log
date: 2026-10-11 22:00
author: jadon
tags: [area/backend, area/dashboard, contract-change]
---
# Org switcher + email invites (contracts v5, D8) #contract-change

- **Did:** one login can belong to several orgs. Dashboard sends `X-Org-Id` (sidebar switcher appears with 2+ orgs). New `org_invites` table + `POST /api/org/invites {email, role}` (admin); pending invites become memberships on the person's next `GET /api/me`. `/me` returns `orgs[]`. Migration `20261011230000_org_invites.sql`. 129 server tests.
- **Others need to know:** Jadon (ai.jadonli09@gmail.com) and Conrad (cspaudie@gmail.com) are invited as admin to both Bank of Antarctica and Mango Clinic. Sign up on the site with that email and you're in both. Reid: waiting on his email.
- **Files / endpoints touched:** `server/src/{app,types}.ts`, stores, `web/src/{api,types}.ts`, `components/Shell.tsx`, `app.css`, `docs/API.md`.
- **Next:** invite UI in `/setup` (API exists); Reid's invite.
