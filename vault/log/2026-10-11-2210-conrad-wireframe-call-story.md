---
type: log
date: 2026-10-11 22:10
author: conrad
tags: [area/dashboard]
---
# /wireframe call story built: first call, returning call, rep callback

- **Did:** Replaced the old neon phone section on `/wireframe` with three scroll-scrubbed scenes: iOS call with transcript under the phone and a brief that fills in and gets confirmed; returning caller recognized by number with time saved; rep queue, brief, history, Call back ringing Maria's phone. Header now matches the landing nav.
- **Others need to know:** Marketing copy only, no API or schema change. Returning greeting and brief shape follow Red's 21:35 change. All names and numbers are labeled demo data. Not deployed.
- **Files / endpoints touched:** `web/src/wireframe/CallStory.tsx` (new), `story.css`, `Wireframe.tsx`, `wireframe.css`, `useScenes.ts`, `context-wireframe.md`.
- **Next:** decide whether the story also replaces the old phone on `/`.
