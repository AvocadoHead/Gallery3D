# Aether Gallery — Roadmap

*Reviewed by Fable, 2026-07-03; updated 2026-07-04 after Phases 1–5 landed (`45ac846`), production was repointed, and OAuth reconnected.*

---

## ✅ Done

- **Phase 0** — production repointed to the new Supabase project, Google OAuth reconnected *(Eyal, dashboard)*.
- **Phase 1** — carousel helix geometry at scale, mount-stagger cap, lazy/async image loading, density gates for Float *(45ac846)*.
- **Phase 2** — private/unlisted/public visibility model + RLS, inline visibility control *(45ac846)*.
- **Phase 3 (revised)** — direct `.mp4`/`.webm` URLs accepted, ▶ badge, lightbox playback *(45ac846)*.
- **Phase 4** — per-item title/description editor, curated fonts, title sizes *(45ac846)*.
- **Phase 5** — share-link size guard, README fix, misc polish *(45ac846)*.
- **Phase 6 — Unified Canvas layout editor** (plain DOM, no three.js). One "Canvas" layout with two sub-modes:
  - **Grid** (default, masonry-like): drag to reorder, resize each item, neighbours reflow via CSS flex-wrap.
  - **Free**: absolute placement with overlap, pan/zoom, **marquee multi-select**, group move + group resize (scale about the selection bbox), z-order (front/back), per-item rotation, and a "Tidy" pack-to-grid.
  - **Text blocks** (`kind: 'text'`) can be added and styled with the title typography in either mode.
  - `MediaItem.canvas {x,y,w,h?,z?,rotation?}`; `w` shared by both modes, `x/y/z/rotation` used in free. Auto grid seed for items without placement. `settings.canvasMode` persists the sub-mode; everything saves through the normal path.
  - Edit is entered from the **Look tab → Edit Layout** (closes the builder so it doesn't cover the canvas); a toolbar handles mode/text/z-order/rotate/delete/Done.
  - Share links carry `?layout=canvas`.
- **Edge "jump" glitch fixed** *(Fable, 2026-07-04)* — see below.
- **Hover-video playback: descoped by decision.** The video-budget/hover-audio machinery was removed. Video cards now show a static first frame (`preload="metadata"` + `#t=0.1`); playback happens only in the lightbox. Do not reintroduce without a new decision.

### The edge-jump fix (for the record)

Symptom: in sphere *and* carousel views, cards near the silhouette visibly "jumped" over each other while auto-rotating. Two combined causes in `FloatingGallery.tsx`:

1. `zIndexRange={[100, 0]}` quantized hundreds of drei `<Html>` cards into just 100 stacking levels. At the silhouette many cards share nearly identical camera depth; their quantized ranks tied and flipped every frame → abrupt stacking swaps. Fixed: `zIndexRange={[50000, 0]}` (safe — the Canvas wrapper is its own `z-0` stacking context, so card z-indexes can never cover the UI).
2. The per-frame **edge tilt** (`rotateY` after `lookAt`) rotated silhouette cards out of billboard alignment so their planes intersected, making every stacking swap look like a physical jump. Removed — cards are now pure billboards. **Don't reintroduce per-card rotation without solving stacking order.**

If any residual swap-flicker is seen on dense spheres, the next lever is damping `<Float>`'s `floatingRange` (neighbor bobbing causes real depth-rank crossings), not z-index.

---

## Phase 6 — Canvas layout (freeform placement)

New layout mode: an open 2D canvas where the owner drags each item anywhere and sizes it freely; visitors get a pan/zoom view. Verdict: **not a hassle — this is the cheapest of the two new layouts** because it's plain DOM (no three.js), and the save path already persists arbitrary per-item fields.

### 6.1 Data + viewer
- Extend `MediaItem` with optional `canvas?: { x: number; y: number; w: number }` (y/x in canvas units, w = width; height follows aspect). Items without `canvas` get an auto grid seed so old galleries open sensibly.
- Add `'canvas'` to the `ViewMode` unions (`App.tsx`, `supabaseClient.ts` `LayoutSettings`, BuilderModal props) and a `CanvasGallery.tsx` component: one absolutely-positioned div per item inside a pan/zoom container (pointer-drag to pan, wheel/pinch to zoom — ~80 lines, no library needed).
- Reuse the existing card styling + lightbox `onSelect`.

### 6.2 Edit mode (owner only)
- When the builder is open in canvas mode: drag to move (pointer events, store on drop), corner handle to resize. Persist via the normal save path — zero backend work.
- Nice-to-have later: z-order (bring forward/back), snap-to-grid toggle.

Size: M (6.1) + M (6.2). Ship 6.1 first — a read-only canvas with auto layout is already shareable.

---

## Phase 7 — 3D Book layout

Reference: the-3d-book.vercel.app (Eyal's prototype). Live-tested it: concept is right, but it blocks first paint behind a "Loading your 3D Book … 100%" preloader for ~25s because it downloads *every* page's media up front. The layout is worth having; the preload strategy is the part to throw away.

### 7.1 Implementation sketch
- New `BookGallery.tsx` inside the existing `<Canvas>`: two-page spread, each page a curved-or-flat plane pair; page-flip = rotation animation on the shared spine axis (drei `useSpring`/manual lerp — no physics needed).
- **Lazy per-spread loading**: only current spread ±1 gets textures/`<Html>` content; everything else is unloaded. First paint = cover only (instant), not 100% of the gallery.
- Items map to pages in order (1–2 items per page depending on aspect); videos show the static first frame, click opens the lightbox (same rules as everywhere else).
- Navigation: click page edge / arrow keys / bottom pager like the prototype (Cover · 1 · 2 · Back).
- Add `'book'` to `ViewMode` unions + a Look-tab option.

Size: L — the flip animation and page mapping are the work; the media pipeline is already shared. Do after Phase 6, and only if the canvas layout doesn't scratch the itch — two new layouts at once doubles the QA surface.

Acceptance for both phases: layout switcher round-trips through save/load (`settings.viewMode`), share links with `?layout=canvas|book` work, 400-item gallery stays responsive (book: memory stays flat while flipping; canvas: use `content-visibility: auto` on offscreen cards).

---

## Backlog (unchanged / still open)

- 1.3 LOD / windowing for 1000+ item galleries (only if needed).
- 3.3 Drive video mimeType batch-detect so Drive videos get the ▶ badge immediately.
- 2.3 Explore polish: sort by views/newest, hide empty/broken-cover galleries.
- `increment_gallery_views` advisor warnings (anon-executable SECURITY DEFINER) — accept or rate-limit.
- **[Eyal — dashboard]** Restrict `VITE_GOOGLE_API_KEY` to production + localhost referrers in Google Cloud Console.
- Replace `window.confirm` delete with styled modal.

## Suggested agent execution order

| # | Task | Depends on | Size |
|---|------|-----------|------|
| 1 | 6.1 canvas viewer + data model | — | M |
| 2 | 6.2 canvas edit mode | 6.1 | M |
| 3 | 7.1 book layout | 6.x shipped | L |
| 4 | Backlog items | any | S each |

Each agent task ends with: `npx tsc --noEmit` + `npm run build` pass, manual check at 3 gallery sizes (5 / 50 / 400 items), and — for DB changes — `get_advisors` re-run.
