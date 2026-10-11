# Wireframe / landing handoff

Status: partial implementation on `main`, 2026-10-11. The requested call story is **not finished**. Keep iterating, do not present this as final.

## User intent

- Make the `/wireframe` experience match the live `tryrung.today` brand: ivory `#f7f7f2`, near-black `#111111`, cobalt `#345cff`, Inter, bold tight headings, thin borders, rounded pills. Keep the scroll-driven 3D/parallax fly tiles and motion. Apple Design reference: https://github.com/emilkowalski/skills/blob/main/skills/apple-design/SKILL.md (motion should be physical, interruptible where user controls it, reduced-motion respected; restraint in visuals).
- Phone call in the corner is the **customer talking to Rung voice agent**, not a chat app. Show a normal iPhone/iOS incoming call, answer, connected call controls/timer. **Do not put neon transcript bubbles inside phone.** Put a transcript **below the phone** with caller and Rung turns, and show how facts become a confirmed brief/context. New caller scenario, then a second returning caller scenario where prior call is recognized and they skip repeating details, with a concrete time saved indication. Show the customer service rep's perspective: ranked queue, full brief/context, prior history, what notifications/messages they see, and how they call back.
- Additional request: apply current wireframe style to `/` landing hero. Keep the 3D tiles flying toward the viewer as the hero scrolls (reference image 1). Add a **smaller** dark word-by-word statement panel (image 2), ranked rows section (image 3), larger footer, and blue top scroll-progress bar (image 4). User dislikes current wireframe header, so do not copy it onto landing.

## Current work

- `/` landing: added 3D fly tiles around existing hero, progress bar, smaller dark statement, ranked callback list, full dark footer. Reused the original wireframe Tile + scroll-scene hook. Landing existing phone/mini queue still there, not yet replaced with requested iOS/new/returning stories.
- `/wireframe`: restyled `wireframe.css` toward live brand. **The TSX and `story.css` are still old**: old neon-style phone has transcript inside, wrong story, old classes `wf-btn-cyan`, `wf-btn-grey` removed in CSS. This route needs finishing, not just polish.
- Extracted `Tile`/`Cube` to `web/src/wireframe/Tile.tsx`. Modified `useScenes.ts`: `data-scene="leave"` for hero and `data-beats`, `data-clock` for upcoming story. `data-at`/`data-talk`/`data-phase` old story hook behavior was removed; so old `/wireframe` story does not animate correctly until rewritten. Better to replace `Wireframe.tsx` story and `story.css` with new composition.
- `web/src/landing/Landing.tsx`, `landing.css`, `web/src/wireframe/{Tile.tsx,Wireframe.tsx,useScenes.ts,wireframe.css}` are mine. Do not touch unrelated `vault/` edits, these predated this task.

## Visual checks

- Built with `cd web && npm run build` on 2026-10-11: passes, one existing >500kB chunk warning.
- Used Vite preview at localhost:4173 and Playwright headless screenshots (under `$JCODE_SCRATCH_DIR/s0.png`, `s400.png`, `s3000.png`, `s3800.png`, `s5275.png`). Desktop 1440x900: hero tiles avoid headline, statement is smaller, ranked list matches sample. Footer CTA text was invisible initially due to `.wf-root :where(a)` specificity and fixed with `!important` in `.wf-btn-ivory`; rescreenshot not yet taken. Mobile **not checked**. `landing-fly` currently hidden at widths <=1040px.
- Current landing hero fly tiles use `data-scene="leave"` (progress starts after section's top scrolls out); check whether effect feels strong enough. It is not pinned like old wireframe hero, but stage content and sections remain usable.

## Product truth: avoid misleading copy

- `vault/project/caller-context.md` describes backend. Phone number recognizes; SMS code authorizes. `lookup_caller` uses org+phone, saved name/last issue/open request. A returning caller with a saved profile can be greeted by name and asked if previous issue is still relevant. **Recognition alone is not verification**; sensitive account/money actions need recent SMS code if required by org. `triage_call` stores a brief and queue item. Dashboard shows priority, reason, trust, returning status, summary, transcript if available. Confirmation SMS to caller has callback ETA/position but no sensitive details (see `server/src/sms.ts`). Do not invent automatic human routing or promise immediate transfer if backend currently does ranked callbacks.
- Landing existing example uses Maria Reyes, 3rd call, $4,200 fraud charge Tuesday, card ending 4417, callback in ~6m. Wireframe old demo uses Maya Chen, Demo Bank, card declined. Pick one consistent narrative and preserve privacy boundaries. Numerical time-saved claim should be labeled illustrative if not measured.

## Next steps

1. Finish `/wireframe` phone story + `story.css`: new caller iOS call screen, transcript under phone, context confirmation, queue/rep handoff. Returning caller scene with memory/time saved. Keep CSS scene progression/reduced motion and small-screen visibility. Make progress bar/header match landing nav or remove wireframe custom nav.
2. Decide whether richer story belongs on `/` too, since user asked current hero styling *and* first request asked wireframe overhaul. Good approach: build reusable story panels in `/wireframe`, optionally link from landing's How it works or move to landing when approved.
3. Verify at desktop and mobile with Playwright screenshots and `npm run build`. Check footer CTA text, title/tiles overlap, transcript readable, reduced motion, navigation links. Don't deploy until user asks.
