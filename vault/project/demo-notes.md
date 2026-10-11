---
type: project
---
# Demo notes (input for the pitch outline)

Add a section per sponsor or feature. Keep each to what we show and say on stage.

## Keewano (sponsor)

**Framing:** Rung's queue shows what's happening right now; Keewano shows the patterns over the day. Keewano counts lag about 5 min, so present them as trends, not live data.

**Where:** Queue page, right column, "Last 24 h · Keewano" card. Five stats: calls queued by urgency, returning vs new callers, callbacks made, details remembered, callback-time texts. ↻ re-asks Keewano; the badge tooltip explains privacy.

**Run of show**
1. **T−15 min:** 2–3 real calls to Bank of Antarctica (+16184644253), mixed urgency. Press Call back on one so "Callbacks made" isn't 0. Press ↻ and check the numbers moved.
2. **Live call:** stay on the queue and brief. Don't point at Keewano; the live call won't show there for ~5 min.
3. **Keewano beat (~20 s):** "Every call also sends anonymous events to Keewano: no phone numbers, no names. It shows the support lead the patterns: how many urgent calls came in today, how many callers were returning (exactly the time Rung saves), and how fast urgent calls got called back."
4. **Optional (~1 min):** open Keewano's own dashboard and ask it a plain-English question about the Rung project. Strongest sponsor moment: their product working on our data.
5. **Closing line:** "Rung gets the right caller called back first, and Keewano shows whether that's happening across the day."

**Watch out**
- The bank's Keewano counts include 3 local test calls from 2026-10-11 ~14:22 that the Today list doesn't show. Real calls before the demo fix the mismatch; they age out after 24 h.
- Counts can trail by up to ~15 min (5 min Keewano ingest + 10 min server cache). ↻ skips the cache (at most once per 60 s).
- Panel hides itself if `KEEWANO_SDK_KEY` / `KEEWANO_ACCESS_TOKEN` are missing on Vercel.
