# Wireframe / landing handoff

Status: 2026-10-11 22:10 UTC (Conrad's agent). `/wireframe` call story is now built (see "Call story, built"). Landing `/` story still uses the old phone. Not deployed.

## User intent

- Make the `/wireframe` experience match the live `tryrung.today` brand: ivory `#f7f7f2`, near-black `#111111`, cobalt `#345cff`, Inter, bold tight headings, thin borders, rounded pills. Keep the scroll-driven 3D/parallax fly tiles and motion. Apple Design reference: https://github.com/emilkowalski/skills/blob/main/skills/apple-design/SKILL.md (motion should be physical, interruptible where user controls it, reduced-motion respected; restraint in visuals).
- Phone call in the corner is the **customer talking to Rung voice agent**, not a chat app. Show a normal iPhone/iOS incoming call, answer, connected call controls/timer. **Do not put neon transcript bubbles inside phone.** Put a transcript **below the phone** with caller and Rung turns, and show how facts become a confirmed brief/context. New caller scenario, then a second returning caller scenario where prior call is recognized and they skip repeating details, with a concrete time saved indication. Show the customer service rep's perspective: ranked queue, full brief/context, prior history, what notifications/messages they see, and how they call back.
- Additional request: apply current wireframe style to `/` landing hero. Keep the 3D tiles flying toward the viewer as the hero scrolls (reference image 1). Add a **smaller** dark word-by-word statement panel (image 2), ranked rows section (image 3), larger footer, and blue top scroll-progress bar (image 4). User dislikes current wireframe header, so do not copy it onto landing.

## Current work

- `/` landing: added 3D fly tiles around existing hero, progress bar, smaller dark statement, ranked callback list, full dark footer. Reused the original wireframe Tile + scroll-scene hook. Landing existing phone/mini queue still there, not yet replaced with requested iOS/new/returning stories.
- `/wireframe`: restyled `wireframe.css` toward live brand. **The TSX and `story.css` are still old**: old neon-style phone has transcript inside, wrong story. The old button classes were changed to the new ink/ghost/ivory pills. This route needs finishing, not just polish.
- Extracted `Tile`/`Cube` to `web/src/wireframe/Tile.tsx`. Modified `useScenes.ts`: `data-scene="leave"` for hero and `data-beats`, `data-clock` for upcoming story. The old `data-at`/`data-talk`/`data-phase` logic was restored for compatibility until the story gets replaced.
- `web/src/landing/Landing.tsx`, `landing.css`, `web/src/wireframe/{Tile.tsx,Wireframe.tsx,useScenes.ts,wireframe.css}` are mine. Do not touch unrelated `vault/` edits, these predated this task.

## Call story, built (2026-10-11 22:10 UTC)

- New `web/src/wireframe/CallStory.tsx` + rewritten `story.css` replace the old neon phone section in `Wireframe.tsx`. Three pinned scenes, scrubbed by scroll via `data-beats` (`--beat` / `data-beat`), timers via `data-clock`:
  1. **First call** (`#story`): Maria Reyes dials Bank of Antarctica. Plain iOS call screen (calling…, live timer, 6 keys, red end). Transcript card **below** the phone with Rung / Maria turns; facts highlighted as spoken. Right: Brief card fills Caller, Issue, Amount, When, Identity (skeleton until captured, check when she confirms the read-back), then Critical 94, Queue #1 ~6 min, profile saved with consent. Call ends, confirmation SMS drops onto the phone in `sms.ts` wording (ETA only, no amounts).
  2. **A week later**: same number. Caller lookup card (Returning, last issue, Recognized by number) with note that recognized is not verified. Greeting matches Red's 21:35 change ("I've got your details up. What can I help you with today?"), she adds one new detail. Time-on-phone bars 2:48 vs 0:52, labeled illustrative.
  3. **Your team**: rung/queue window. Toast "New callback ranked #1", Maria row drops in, detail pane opens: brief in headline / When / Wants shape, Open with line, history of both calls, text-sent note. Sam taps Call back, Maria's iPhone shows a normal **incoming** call, accepts, connected timer.
- Reading of "incoming call": Maria is the one dialing in scenes 1 and 2 (outgoing calling… screen). The true incoming/answer moment is the rep's callback in scene 3.
- Header now copies the landing nav (static, centered links with dots, "Get started, it's free"). The fixed blurred bar is gone.
- `useScenes.ts`: removed the legacy `data-at`/`data-talk`/`data-phase` code (nothing else used it); `data-beats` also sets `data-beat` and only writes on change.
- Lower `/wireframe` queue section now leads with Maria Reyes for one consistent narrative. Every scene shows "Demo data. Names, amounts and timings are illustrative."
- Verified: `npm run build` passes; Playwright at 1440x900 and 390x844 across beats, no horizontal overflow; reduced motion snaps each scene to its final state. On phones the steps list shows only the current step, phone sits beside the brief, transcript below.

## Pass 2 (2026-10-11 22:45 UTC, Conrad's feedback)

- Conrad's rules: no step lists, no "01 · ..." kickers, no "Demo data" lines, no accent-bar callouts, minimal text everywhere.
- Story now uses sticky visual + one short headline that crossfades per stage (`Lines` in `CallStory.tsx`).
- Rep scene: "Open with" block, meta text and window title bar removed; phone sits beside the window (not over it), slim frame; iOS status bar uses real signal / Wi-Fi / battery glyphs.
- Hero centerpiece is a text-free copy of the real dashboard layout (ink sidebar, 4 tiles with cobalt first, ranked list, tinted brief). Verification and Language tiles moved off the title/subtitle.
- Header is a floating pill (fixed, centered, blurred white). "Made with" monochrome marquee at the bottom: Dial, Supabase, Vercel, Keewano, Claude, React, TypeScript, MCP (text wordmarks, no logos).

## Pass 3 (2026-10-11 22:55 UTC)

- Header has a For humans / For agents segmented control (same glass). `?view=agents` swaps the page for `AgentView.tsx`, which renders `web/public/llms.txt` (llms.txt convention) as plain HTML with Copy as Markdown. Keep llms.txt factual to `vault/project/contracts.md`.
- Pricing section `#pricing`: contact only, hello@tryrung.today with Copy email + Contact us (mailto). The ranked list section is now `#ranked`.
- Made with strip shows official marks from Simple Icons (CC0) for Supabase, Vercel, Claude, React, TypeScript, MCP (`stackMarks.ts`). Dial and Keewano are text until we get their logo files.
- Open question for Conrad: cut the horizontal "Everything your agent already knows" cards (recommended; they repeat the story).

## Visual checks (earlier pass)

- Built with `cd web && npm run build` on 2026-10-11: passes, one existing >500kB chunk warning.
- Used Vite preview at localhost:4173 and Playwright headless screenshots (under `$JCODE_SCRATCH_DIR/s0.png`, `s400.png`, `s3000.png`, `s3800.png`, `s5275.png`, and `390-landing-top.png`, `390-wireframe-story.png`). Desktop 1440x900: hero tiles avoid headline, statement is smaller, ranked list matches sample. At 390px, landing headline/CTA/phone are readable. Neither route has horizontal overflow at 390px or 1440px. Footer CTA text/color verified at both widths. `/wireframe` phase reaches `dash`, but its mobile story is still a tiny old neon phone above a queue, not the requested design. `landing-fly` currently hidden at widths <=1040px.
- Current landing hero fly tiles use `data-scene="leave"` (progress starts after section's top scrolls out); check whether effect feels strong enough. It is not pinned like old wireframe hero, but stage content and sections remain usable.

## Interpretation choices to confirm

- I read "apply parts of the current wireframe style to the current hero" as changing the live `/` landing page while keeping `/wireframe` as a separate work-in-progress. That is why both routes changed. If intent was only `/wireframe`, move or drop the landing additions.
- I read "normal iMessage call dialog" as an ordinary iOS **Phone** incoming/connected call UI, not SMS chat bubbles. The transcript belongs beneath the device. This is still to be implemented.
- The sample figures and queue names in the landing additions are illustrative wireframe content, not live analytics. Label them as demo data if this becomes public-facing production copy.

## Product truth: avoid misleading copy

- `vault/project/caller-context.md` describes backend. Phone number recognizes; SMS code authorizes. `lookup_caller` uses org+phone, saved name/last issue/open request. A returning caller with a saved profile can be greeted by name and asked if previous issue is still relevant. **Recognition alone is not verification**; sensitive account/money actions need recent SMS code if required by org. `triage_call` stores a brief and queue item. Dashboard shows priority, reason, trust, returning status, summary, transcript if available. Confirmation SMS to caller has callback ETA/position but no sensitive details (see `server/src/sms.ts`). Do not invent automatic human routing or promise immediate transfer if backend currently does ranked callbacks.
- Landing existing example uses Maria Reyes, 3rd call, $4,200 fraud charge Tuesday, card ending 4417, callback in ~6m. Wireframe old demo uses Maya Chen, Demo Bank, card declined. Pick one consistent narrative and preserve privacy boundaries. Numerical time-saved claim should be labeled illustrative if not measured.

## Next steps

1. ~~Finish `/wireframe` phone story~~ done, see above. Open: hero tiles on `/wireframe` mobile still overlap the dashboard (pre-existing).
2. Decide whether richer story belongs on `/` too, since user asked current hero styling *and* first request asked wireframe overhaul. Good approach: build reusable story panels in `/wireframe`, optionally link from landing's How it works or move to landing when approved.
3. Verify at desktop and mobile with Playwright screenshots and `npm run build`. Check footer CTA text, title/tiles overlap, transcript readable, reduced motion, navigation links. Don't deploy until user asks.
