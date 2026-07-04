# Aether Gallery — Roadmap

*Reviewed by Fable, 2026-07-03. Code review of commit `21affd8` + live test of gallery3-d.vercel.app + Supabase inspection.*

The concept and usability are genuinely strong — the review below found the architecture sound. The DB schema, RLS policies, trigger functions, and component structure from the "Reimagine" commit all check out. The issues are fixable and most are smaller than they look. Phases are ordered by urgency; each task is scoped for a single Sonnet agent session unless marked **[Eyal — dashboard]** (things only a human with dashboard access can do).

---

## Phase 0 — Production is broken. Fix first. 🔥

**Root cause found:** the deployed Vercel build still points at the OLD Supabase project (`hsdafjouczzkmgzjkftx`, "3D Gallery"), which is now **INACTIVE/paused**. Every auth and data request from production fails — this is what looks like "Google OAuth expired." Live test confirmed: Explore renders `TypeError: Failed to fetch`. Meanwhile local `.env.local` points at the new project (`ojdskkpiwwvdzmtkoxvv`), whose `galleries` and `profiles` tables are **empty** (0 rows) and whose auth logs show zero login attempts — production has never touched it.

### 0.1 [Eyal — dashboard] Repoint Vercel to the new Supabase project
- In Vercel → Project Settings → Environment Variables: set `VITE_SUPABASE_URL=https://ojdskkpiwwvdzmtkoxvv.supabase.co` and the matching `VITE_SUPABASE_ANON_KEY` (values are in local `.env.local`). Redeploy.
- Verify: Explore loads (shows "No public galleries yet" instead of fetch error).

### 0.2 [Eyal — dashboard] Configure auth on the new project
- Supabase dashboard (Aether Gallery project) → Authentication → Providers → enable **Google**, paste the Google client ID/secret (reuse the ones from the old project's config, or create fresh in Google Cloud Console).
- Authentication → URL Configuration: Site URL `https://gallery3-d.vercel.app`; add Redirect URLs for production and `http://localhost:3000`.
- If the Google Cloud OAuth consent screen is in **Testing** mode, publish it — testing-mode refresh tokens expire every 7 days, which also presents as "OAuth keeps expiring."
- Verify: Google sign-in round-trips on production.

### 0.3 Rescue the old galleries (agent + Eyal)
- Any galleries users saved live in the paused old project. Paused Supabase free-tier projects can be restored for a window, then risk deletion.
- **[Eyal]** Restore/unpause `hsdafjouczzkmgzjkftx` from the dashboard (or approve agent doing it via MCP `restore_project`).
- **[Agent]** Export `galleries` rows from the old project, map to the new schema (`layout_settings` → `settings`, add `is_public=false`, derive `cover_url`), insert into the new project, spot-check a few slugs load.

---

## Phase 1 — Carousel at scale (the 400-image glitch)

Reproduced live with the ~290-item demo: the carousel collapses into an overlapping "deck of cards" wall. Four compounding causes, all in `components/FloatingGallery.tsx` and `constants.ts`:

1. **Geometry**: `getCarouselCoordinates` puts ALL items on one ring. Spacing = 2πR/N; the radius formula (`FloatingGallery.tsx` `GalleryScene`) grows at most 2× regardless of count, so at N=400 each card gets ~0.5 world-units of arc while cards are several units wide.
2. **DOM weight**: every item is a drei `<Html transform>` node — 400 live DOM elements repositioned every frame, each also running `lookAt` + `rotateY` in `useFrame`.
3. **Mount stagger**: `setTimeout(..., index * 20)` means item #400 appears after **8 seconds** — feels broken.
4. **Loading**: 400 `<img loading="eager" decoding="sync">` fire simultaneously; sync decode janks the main thread.

### 1.1 Count-aware carousel geometry
- In `constants.ts`, rewrite `getCarouselCoordinates(count, radius)`: when count exceeds what one ring fits (`fitPerRing = floor(2πR / minSpacing)`), spiral into a **helix** — multiple stacked rings with a small vertical pitch, or concentric rings. Keep the undulation only for small counts.
- Alternatively/additionally: derive ring radius from count (`R = max(radius, count * minSpacing / 2π)`) and let OrbitControls' maxDistance scale accordingly.
- Acceptance: 400 items → no card overlaps its neighbor by more than ~20%; camera can still see the whole arrangement.

### 1.2 Performance pass on `GalleryItem`
- Cap the mount stagger: `Math.min(index * 20, 1500)`.
- Replace `loading="eager" decoding="sync"` with `loading="lazy" decoding="async"` (the card is already opacity-gated on load, nothing regresses).
- Skip the per-frame `rotateY` edge-tilt when `items.length > ~150` (invisible at that density, saves 400 rotations/frame).
- Consider disabling drei `<Float>` above ~200 items (400 independent float animations).
- Acceptance: 400-item demo reaches interactive < 3s on desktop, stays > 30fps while auto-rotating.

### 1.3 (Stretch) LOD / windowing for huge galleries
- For N > ~250, render distant items as lightweight textured planes (`THREE.Mesh` + `TextureLoader`) and only promote the ~60 items nearest the camera to interactive `<Html>` cards. This is the real fix for 1000+ item galleries; do 1.1/1.2 first since they may be enough for 400.

---

## Phase 2 — Visibility model: private / unlisted / public

The "List on Explore" toggle already exists (BuilderModal → Edit tab) and the DB has `is_public` + RLS. But the current model has a trap the review caught:

**Bug: private share links are broken by design.** RLS read policy is `is_public OR auth.uid() = owner_id`. So when you share a non-public gallery's link (`/?gallery=slug`), recipients get "Gallery not found." Sharing is the core loop — this silently kills it for every private gallery.

### 2.1 Three-state visibility
- Migration (new project): add `visibility text not null default 'unlisted' check (visibility in ('private','unlisted','public'))`; backfill from `is_public`; keep `is_public` as a generated column or drop it and update code.
- New RLS read policy: `visibility in ('unlisted','public') OR auth.uid() = owner_id`.
- `listPublicGalleries` filters `visibility = 'public'`.
- Frontend: replace the toggle with a 3-option segmented control (Private 🔒 / Unlisted 🔗 / Public 🌐) with one-line explanations. Default **unlisted** so share links always work.
- Files: `supabaseClient.ts`, `components/BuilderModal.tsx`, `App.tsx`, `types/supabase.ts` (regenerate via MCP `generate_typescript_types`).

### 2.2 Visibility control in My Galleries list
- Each row in BuilderModal's My Galleries tab should show current visibility and allow flipping it inline (single `update ... set visibility` call) without loading + resaving the whole gallery.

### 2.3 Explore polish (after 0.x makes it live)
- Empty-state already good. Add: sort by views/newest, and only list galleries with ≥1 item and a working cover.

---

## Phase 3 — Real video in the gallery

Current state (correct reading of the code): YouTube/Vimeo/Drive items all show **thumbnails** in cards and play properly in the lightbox (`Overlay.tsx` handles YT/Vimeo embeds, Drive mimeType detection via API key, iframe player). The muted-video/hover-audio machinery you built **already exists** in `FloatingGallery.tsx` (`useVideo`, volume-fade effect) — it's just unreachable, because:

- Drive items are always created with `kind: 'image'` (`constants.ts` `createMediaItem`), and
- **direct `.mp4`/`.webm` URLs are silently dropped** — `createMediaItem` returns `null` for them. Users pasting direct video links see nothing, with no error. (README also claims video links work — docs mismatch.)

### 3.1 Stop dropping direct video URLs
- `createMediaItem`: for `isDirectVideo(input)`, return `kind: 'video'`, `videoUrl: input`, `previewUrl: ''` (the card's `shouldShowVideoInCard` path then renders the `<video>` element — which is exactly the dormant hover-audio code path).
- Show a small ▶ badge on video cards (TileGallery already does this; mirror it in the 3D card).

### 3.2 In-card muted playback, audio on hover — bounded
- The naive version (N videos all decoding) is the hassle you sensed. Make it cheap:
  - Videos render as **thumbnail first** (poster or first-frame via `preload="metadata"`).
  - At most **K=6 videos** actually play (muted) at once — the ones nearest the camera / in viewport; others stay posters.
  - Hover: existing volume-fade effect kicks in (already written, lines ~99–118 of FloatingGallery). Pause + remute on leave (already written).
- Acceptance: gallery with 20 direct-video items stays smooth; hovering any video fades audio in.

### 3.3 Drive videos in cards (optional, needs API key)
- Where a `VITE_GOOGLE_API_KEY` exists, batch-check Drive items' mimeType on gallery load (the lightbox already does this per-item) and flip `kind` to `video` for actual videos, so they get the ▶ badge and correct lightbox behavior immediately instead of after the API round-trip.

---

## Phase 4 — Per-item title & description (with typography)

Good news from the review: this is ~70% plumbed already. `MediaItem` has optional `title`/`description` fields (`constants.ts`), the lightbox **already renders them** (`Overlay.tsx` INFO BAR), and `items` is a jsonb column so no migration is needed. What's missing is editing UI and typography options. It's less of a hassle than you think.

### 4.1 Per-item editor in BuilderModal
- New "Items" sub-view in the Edit tab: thumbnail list of current `galleryItems`, each row expandable to edit `title` + `description`.
- Requires lifting the raw-textarea workflow: keep the textarea for bulk URL entry, but once items are built, edits happen per-item (re-running `buildMediaItemsFromUrls` currently regenerates ids and would wipe titles — instead, diff by `originalUrl` and preserve existing items' metadata).
- Save path already persists whatever is on the items — zero backend work.

### 4.2 Typography options (scoped, not infinite)
- Extend `MediaItem` with optional `titleFont`, `titleSize` (S/M/L/XL), maybe `titleColor`.
- Curated font list (~10 Google Fonts incl. a Hebrew-friendly set — Heebo is already loaded for the display name) rather than "any font" — same expressive power, none of the load-a-random-font complexity.
- Render title on card hover (small caption bar) and in the lightbox INFO BAR using those fields.
- Gallery-level defaults in the Look tab; per-item override in the item editor.

---

## Phase 5 — Hardening & polish (post-fix cleanup)

- **Share-link size bomb**: unsaved galleries encode every URL base64 into the link (`encodeGalleryParam`). A 400-item gallery produces a multi-10KB URL — breaks WhatsApp and some browsers. Fix: above ~30 items, require save-to-share (short slug link) and say so in the UI.
- **Supabase advisors** flagged `increment_gallery_views` as anon-executable SECURITY DEFINER (by design, but add a per-slug sanity cap or accept the risk consciously). Links: [0028](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- **[Eyal — dashboard]** Restrict the exposed `VITE_GOOGLE_API_KEY` in Google Cloud Console to your production + localhost referrers (it's in the shipped JS bundle — normal for browser keys, but restrict it).
- `handleStartNew` resets `mediaScale` to `1` while the app default is `0.8` — make consistent.
- On `SIGNED_OUT` the auth listener force-opens the builder modal (`App.tsx`) — jarring; just show a toast.
- README promises direct video links work; align docs after Phase 3.
- Delete confirmation uses `window.confirm` — replace with styled modal (low priority).

---

## Suggested agent execution order

| # | Task | Depends on | Size |
|---|------|-----------|------|
| 1 | 0.1 + 0.2 (Eyal, ~15 min of dashboard clicks) | — | human |
| 2 | 0.3 data rescue | 0.1 | S |
| 3 | 1.1 + 1.2 carousel geometry & perf | — | M |
| 4 | 2.1 visibility model + RLS migration | 0.1 | M |
| 5 | 2.2 inline visibility control | 2.1 | S |
| 6 | 3.1 + 3.2 video cards | — | M |
| 7 | 4.1 per-item editor | — | M |
| 8 | 4.2 typography | 4.1 | S |
| 9 | 1.3 LOD (only if 400+ still janky) | 1.1 | L |
| 10 | Phase 5 items | any | S each |

Each agent task should end with: `npm run build` passes, manual check of the affected flow at 3 gallery sizes (5 / 50 / 400 items), and — for DB changes — `get_advisors` re-run.
