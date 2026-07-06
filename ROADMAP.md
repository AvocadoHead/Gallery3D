# Aether Gallery — Roadmap to Perfection

*Reviewed by Fable, 2026-07-05, at working tree of `1fd44c7` (+ uncommitted polish). Everything below compiles today (`npx tsc --noEmit` clean). Tasks are written for smaller agent models: exact files, functions, signatures, and acceptance checks. Do the tasks in order — T1/T2 are Eyal's explicit asks.*

## State of the code (short)

All previous phases are done and reviewed: 4 layouts (Sphere, Carousel, editable Masonry with grid/free sub-modes + text blocks, 3D Book), visibility model, per-item titles/typography, video-as-thumbnail policy, share-link guard. The review found the architecture healthy. The remaining flaws are concentrated in the **Book** pipeline (`components/book/bookTextures.ts`, `components/BookGallery.tsx`) plus a handful of leftovers.

### Guardrails for all agents — do NOT:
- Reintroduce per-card rotation or narrow `zIndexRange` in `FloatingGallery.tsx` (causes the edge-jump glitch — see git history).
- Rebuild items from the URL textarea inside save paths — `galleryItems` is the source of truth; `mergeMediaItems` exists for textarea edits.
- Change the DB schema for any task here (none needs it).
- Re-add in-card video playback (descoped by decision).
- Replace the skinned-mesh book with CSS/react-pageflip (already tried and rejected).

---

## T1 — Book loading progress bar *(S — Eyal's ask)*

**Problem:** `buildBookLeaves` awaits ALL images (`Promise.all`) behind a single "Binding your book…" spinner. On a big gallery users stare at a spinner for 30+ seconds with no sign of life and give up.

**Steps:**
1. In `components/book/bookTextures.ts`, change the signature:
   ```ts
   export const buildBookLeaves = async (
     urls: string[],
     perPage: 1 | 2 | 4,
     title: string,
     onProgress?: (loaded: number, total: number) => void,
   ): Promise<BookLeaf[]>
   ```
2. Inside, replace the plain `Promise.all(normalized.map(loadImage))` with a counted version:
   ```ts
   let done = 0;
   const images = await Promise.all(
     normalized.map((u) =>
       loadImage(u).then((img) => {
         done += 1;
         onProgress?.(done, normalized.length);
         return img;
       }),
     ),
   );
   ```
3. In `components/BookGallery.tsx`, add `const [progress, setProgress] = useState({ done: 0, total: 0 });` reset it in the build effect, and pass `(done, total) => { if (alive) setProgress({ done, total }); }` as the 4th argument.
4. Replace the spinner block (the `if (!leaves)` branch) with a progress UI: keep the spinner, add a bar and count. Bar: outer `w-56 h-2 bg-slate-200 rounded-full overflow-hidden`, inner `h-full bg-slate-700 rounded-full transition-all duration-300` with `style={{ width: total ? `${(done / total) * 100}%` : '4%' }}`. Text under it: `Binding your book… {done} / {total}` (`{total > 0 && …}` guard).

**Accept:** open a 50+ item gallery in Book layout → bar advances visibly from 0 to full before the book appears; `tsc` + `vite build` pass.

---

## T2 — First & last items become the covers *(M — Eyal's ask)*

**Problem:** the front cover is a synthetic dark title card and the back cover is blank. Eyal wants **item #1 on the front cover and the last item on the back cover**, so reordering the items list in the builder directly edits the book (covers included).

**All changes in `components/book/bookTextures.ts` (`buildBookLeaves`):**
1. After loading images (T1 code), split them:
   ```ts
   const valid = images.filter((i): i is HTMLImageElement => !!i);
   const coverImg = valid.length >= 1 ? valid[0] : null;
   const backImg  = valid.length >= 3 ? valid[valid.length - 1] : null; // need ≥3 so interior isn't empty
   const interior = backImg ? valid.slice(1, -1) : valid.slice(coverImg ? 1 : 0);
   ```
2. New helper `imageCoverTexture(img: HTMLImageElement, title?: string): string` — full-bleed composite:
   - canvas `PAGE_W × PAGE_H`, draw the image **cover-cropped** (scale = `Math.max(PAGE_W/img.width, PAGE_H/img.height)`, center the overflow, `ctx.drawImage`).
   - If `title` is non-empty: draw a bottom gradient (`ctx.createLinearGradient(0, PAGE_H*0.65, 0, PAGE_H)`, transparent → `rgba(0,0,0,0.65)`, fillRect the bottom 35%), then the existing word-wrap title code in white, but positioned at `PAGE_H * 0.85` instead of center.
   - Return `canvas.toDataURL('image/jpeg', 0.85)`.
3. Assemble sides:
   ```ts
   const frontCover = coverImg ? imageCoverTexture(coverImg, title) : coverTexture(title);
   const backCover  = backImg ? imageCoverTexture(backImg) : blankTexture();
   const contentSides = chunk(interior, perPage).map((g) => renderLayout(g, GRID_LAYOUTS[perPage]));
   if (contentSides.length % 2 === 1) contentSides.push(blankTexture()); // back cover must land on a leaf BACK
   const allSides = [frontCover, ...contentSides, backCover];
   ```
   (The parity pad is the important line: leaves pair sides as `[front, back]`, and the back cover must be the final `back`.)
4. Keep the degenerate-book guard (`leaves.length === 0`) as is. Edge cases that must not crash: 0 images (title cover + blank), 1 image (that image on the cover, empty interior), 2 images (cover + one interior page, no image back cover).

**Accept:** book with N≥3 items shows item 1 full-bleed on the closed cover with the gallery title over a bottom gradient; flipping to the end shows the last item on the back cover; those two items do NOT repeat inside; reordering items in the builder (My Items editor) then reopening Book layout moves the covers accordingly; 0/1/2-item galleries render without errors.

---

## T3 — Book memory diet *(M — do before shipping big books)*

**Problem:** every page side is a `1325×1771` **PNG** dataURL and **every leaf stays mounted with full-res textures**. At 400 items ÷ 2/page ≈ 100 leaves ≈ 200 textures ≈ **~1.9 GB of GPU memory** plus hundreds of MB of dataURL strings — tab death on mobile. This is exactly what made the original prototype "really heavy and slow".

**Steps (all safe, in ascending effort — land 1+2 even if 3 stalls):**
1. **JPEG, not PNG** (`bookTextures.ts`): every `toDataURL('image/png')` → `toDataURL('image/jpeg', 0.85)`, including `blankTexture`/`coverTexture`/`renderLayout`. (~5× smaller strings; decode is faster too.)
2. **Resolution scales with book size** (`bookTextures.ts`): in `buildBookLeaves`, before compositing compute
   ```ts
   const sides = Math.ceil(urls.length / perPage) + 2;
   const scale = sides <= 24 ? 1 : sides <= 80 ? 0.75 : 0.5;
   ```
   and thread `scale` into the canvas helpers (`canvas.width = Math.round(PAGE_W * scale)` etc — multiply ALL layout constants incl. PAD and font sizes by `scale`; simplest is to make each helper take `scale` and multiply at canvas creation, drawing in a `ctx.scale(scale, scale)` transform so the layout math stays in PAGE_W/H units).
3. **Leaf windowing** (`components/book/Book.tsx`): only leaves near the current spread carry real textures.
   - In `Book`, compute `const window = 5;` and for each index: `const near = Math.abs(index - delayedPage) <= window || Math.abs(index + 1 - delayedPage) <= window;`
   - `near` leaves render the existing `<Page …/>`.
   - Far leaves render a cheap placeholder `<FarPage number={index} page={delayedPage} opened={delayedPage > index} />`: a plain (non-skinned) `<mesh geometry={pageGeometry}>` with the static `pageMaterials` (no photo maps), `rotation-y` set directly to `opened ? -Math.PI/2 : Math.PI/2` plus the same `degToRad(number * 0.8)` fan-out, at the same `position-z`. No `useFrame`, no bones. Because `delayedPage` walks one step at a time, a far leaf always becomes `near` before it needs to animate.
   - `useTexture` caches by URL, so re-entering the window re-uses decoded textures; drei's cache holds the strings anyway — acceptable.

**Accept:** 400-item book at perPage=2 opens without the tab exceeding ~600 MB (Chrome Task Manager), flips smoothly through 20 consecutive pages, and jumping Cover→End via repeated next clicks never shows an untextured *animating* page. Small books (≤24 sides) look identical to today (scale 1).

---

## T4 — Leftover cleanups *(S each — one agent session total)*

1. **Delete dead `components/TileGallery.tsx`** — nothing imports it (Masonry is `CanvasGallery` now). Also delete its entry from any docs.
2. **Remove the vestigial `tileGap` chain** — `CanvasGallery` ignores it and the Look tab no longer renders a Gap slider. Remove: `tileGap` state in `App.tsx`, the `tileGap`/`setTileGap` props through `BuilderModal`, `gap` in `generateShareLink`/`applyDisplayParams`, and `tileGap` from the save payload. KEEP `tileGap?: number` in `LayoutSettings` (`supabaseClient.ts`) so old saved records still typecheck when loaded; just stop consuming it.
3. **Share-link fidelity for the new layouts** — in `App.tsx` `generateShareLink`: when `viewMode === 'book'` append `url.searchParams.set('perpage', String(bookPerPage))`; when `viewMode === 'tile'` append `mode=${canvasMode}`. In `applyDisplayParams`: parse `perpage` (`1|2|4` guard → `setBookPerPage`) and `mode` (`grid|free` guard → `setCanvasMode`).
4. **Book skipped-items notice** — `buildBookLeaves` silently drops images that fail to load (e.g. direct `.mp4` items, dead links). Return `{ leaves, skipped: normalized.length - valid.length }` (adjust the two call-site lines in `BookGallery.tsx`), and when `skipped > 0` show a small dismissible pill over the book: `"{skipped} item(s) couldn't be shown in the book"`.
5. **`bookUrl` should prefer thumbnails for non-Drive providers** — in `BookGallery.tsx`, YouTube/Vimeo already use `previewUrl` (good); direct videos have `previewUrl: ''` and fall through to the `.mp4` URL which can never load as an image — filter them out up front: `items.filter((i) => i.kind !== 'text' && !(i.kind === 'video' && !i.previewUrl && !i.fallbackPreview))`, so `skipped` (task 4) reflects reality at zero network cost.

**Accept:** `tsc` + build pass; grep finds no `TileGallery` import, no `tileGap` outside `LayoutSettings`; a shared unsaved `?layout=book&perpage=4` link opens as a 4-per-page book.

---

## T5 — Mobile pinch-zoom for Masonry free mode *(M — optional, last)*

`CanvasGallery` free mode zooms only via `onWheel`; phones can't zoom. In the pointer handlers keep a `Map<pointerId, {x,y}>` of active pointers; when a second pointer goes down on empty space, start `session.current = { kind: 'pinch', startDist, startScale: view.scale, cx, cy }` (midpoint in viewport coords); on move, `scale = clamp(0.2, 3, startScale * dist/startDist)` reusing the exact zoom-about-point math from `onWheel` with the midpoint as anchor; ignore marquee/move while pinching. Test on a real phone or DevTools touch emulation.

---

## Verification protocol (every task)

1. `npx tsc --noEmit` → clean.
2. `npx vite build` → succeeds (on Linux CI/sandbox first run: `npm i --no-save @rollup/rollup-linux-x64-gnu`).
3. Manual: open the demo gallery (~290 items) AND a 5-item gallery in the affected layout; check the specific acceptance line of the task.
4. Book tasks: also check Chrome Task Manager memory before/after.
5. Nothing else changed: `git diff --stat` touches only the files the task names.
