# Aether Gallery — Book, Round 2

*Fable, 2026-07-06 (late). I browsed the DEPLOYED book firsthand (demo gallery, 290 items → 72 leaves, layout switching, page jumps, orbiting). The One-Fell-Swoop sprint (`25b984c`) is live and helped — cover shows item 1 with the title, progress bar works, gutter is white — but four real defects remain. Every one is reproduced and root-caused below. Previous guardrails still apply (see git history of this file).*

## What I reproduced on gallery3-d.vercel.app

1. **Click-teleport:** I clicked ~4px off the "next" arrow, hit a background page mesh, and the book jumped Cover → 14/72. Any page anywhere on screen is clickable and teleports to its own position. With 72 fanned leaves, stray clicks are constant.
2. **The "thin pixel-wide frame floating behind the book"** (Eyal's report — confirmed): the `FarPage` placeholder stubs are FLAT rotated planes, while the real near pages are bone-CURVED. Flat stubs are effectively longer than their curved neighbours, so their tips stick out past the curved stack and read as detached pixel-thin blades/frames floating behind and beside the book. Zoomed screenshots show the stub tips protruding well past the textured pages.
3. **Stacks read as venetian blinds, not a book block:** turned/unturned stacks show visible air between leaves (fan is 0.4°/leaf, clamp ±6°) — at grazing angles that's a striped slab hovering in space.
4. **Open-book framing is wrong:** the default camera + fixed −45° tilt look great for the CLOSED cover, but an open spread presents as a steep "V" seen at a grazing angle — pages look like waving flags and half the composition is off-screen. (This, not page curvature, is why art looks warped at rest.)
5. **Post-build blank:** after the progress bar finishes, leaves exist but texture decode/upload leaves an EMPTY scene for several seconds (nav says "Cover", no book). The progress overlay unmounts too early.
6. **Console: `THREE.WebGLRenderer: Context Lost`** when switching Sphere→Book — two separate `<Canvas>` instances churn WebGL contexts. Risky (some browsers never restore) and it's the likely source of occasional all-white scenes.

---

## R1 — Only the current spread is clickable *(XS, `components/book/Book.tsx`)*

In `Page`'s `onClick` (and the hover-highlight handlers): ignore unless the page is adjacent to the current spread:

```ts
const clickable = number === page || number === page - 1; // forward flip or back flip
```

`onClick`: `if (!clickable) return;` before the existing `setPage(...)`. `onPointerEnter`: only `setHighlighted(true)` when `clickable`.
**Accept:** clicking any distant stack/leaf does nothing; clicking the right page turns forward, left page turns back; cursor only becomes pointer over the current spread.

## R2 — Kill the floating thin frames *(S, `components/book/Book.tsx`)*

`FarPage` stubs must never protrude past curved real pages:
1. Scale stubs down slightly and tuck them: on the `<mesh>` add `scale={[0.965, 0.985, 1]}` (x shrink hides the tip behind curved neighbours; the bone curve shortens a real page's projected length by ~2–3%).
2. Give stubs a tighter fan than real pages: `const fan = Math.max(-2, Math.min(2, (number - page) * 0.15));`
3. Stubs already use the plain white materials — keep that.

**Accept:** orbit all around a 72-leaf book at any page — no white blade/outline extends past the textured page edges; the stack silhouette is a clean block.

## R3 — Tighten the leaf fan globally *(XS, `components/book/Book.tsx`)*

In `Page` (line ~151): `(number - page) * 0.4` clamp ±6 → `(number - page) * 0.15` clamp **±3**. (R2 already sets stubs to 0.15/±2.) The stacks should read as one solid book block with a whisper of separation, not blinds.

## R4 — Frame the open book properly *(M, `components/BookGallery.tsx` + `Book.tsx`)*

The fixed `−45°` Float tilt suits a closed cover (poster look) but presents an open spread edge-on.
1. Replace the static tilt with a state-driven one: in `Book`, wrap everything in an inner `<group ref={tiltRef}>`; each frame `easing.dampAngle(tiltRef.current.rotation, 'x', bookClosed ? -Math.PI / 5 : -Math.PI / 2.6, 0.4, delta)` — closed ≈ −36° (upright cover), open ≈ −69° (album lying toward the viewer). Remove `rotation-x` from the `<Float>` in `BookGallery`.
2. Camera & controls (`BookGallery`): `camera={{ position: [0, 1.7, 3.1], fov: 45 }}`; OrbitControls `target={[0, 0.2, 0]}` `minPolarAngle={0.4}` `maxPolarAngle={Math.PI / 2.4}` `minDistance={1.8}` `maxDistance={7}`.
3. These numbers are starting points — tune by eye in `npm run dev`. **Accept:** at default view, BOTH pages of an open spread face the viewer (no grazing angle, art clearly readable); the closed cover still presents nicely; you can never orbit under the book.

## R5 — No blank between progress bar and first frame *(S, `components/BookGallery.tsx`)*

Textures decode AFTER `leaves` resolves, so the overlay unmounts while the scene is still empty.
1. Create a tiny bridge inside the Canvas: `const Ready = ({ onReady }: { onReady: () => void }) => { const { active } = useProgress(); useEffect(() => { if (!active) onReady(); }, [active, onReady]); return null; };` (`useProgress` from drei tracks texture loading.)
2. `const [firstFrameReady, setFirstFrameReady] = useState(false);` — mount `<Ready onReady={() => setFirstFrameReady(true)} />` in the scene; keep the full-screen progress overlay rendered (absolutely positioned OVER the Canvas, don't unmount the Canvas) until `leaves && firstFrameReady`. Show the bar at 100% with "Opening…" during the gap.
**Accept:** from clicking "Book" to seeing the cover there is never an empty scene; the overlay dissolves straight into the rendered book.

## R6 — One WebGL context for all 3D layouts *(M, structural — do last)*

`App.tsx` unmounts the sphere/carousel `<Canvas>` and `BookGallery` mounts its own → `THREE.WebGLRenderer: Context Lost` in console (reproduced by switching Sphere→Book). Move the book INTO the main Canvas:
1. In `App.tsx`, render one `<Canvas>` for `viewMode !== 'tile'`; inside it: `viewMode === 'book' ? <BookScene …/> : <GalleryScene …/>`.
2. `BookGallery` becomes a thin DOM wrapper: build-leaves state machine + progress overlay + nav buttons + skipped pill (all already DOM), passing `leaves/page/setPage` down; export `BookScene` from it.
3. Book needs `shadows` and its own camera position — set camera via a small `CameraRig` component that eases `camera.position` between the sphere default `[0,0,65]` and the book default `[0,1.7,3.1]` on mode change (`easing.damp3`), and toggle `gl.shadowMap.enabled` accordingly. Lights/Environment: render the book's studio lights only in book mode.
**Accept:** switching Sphere↔Carousel↔Book repeatedly logs zero `Context Lost`, book shadows still render, sphere unchanged.

## R7 — Long jumps: snap, don't riffle 30 leaves *(S, `components/book/Book.tsx`)*

Even flat riffles look chaotic beyond ~10 leaves (reproduced: Cover→14 fills the screen with mid-air pages). In the `goToPage` walker: when `Math.abs(page - dp) > 6`, return `page > dp ? page - 3 : page + 3` in ONE step (instant, no timeout), then let the existing 30/150ms walk animate only the last 3 turns.
**Accept:** pager jump Cover→End animates ~3 clean turns; nothing fans mid-air.

---

## Order & verification

`R1 → R3 → R2 → R7 → R5 → R4 → R6` (R6 last — it moves code the others touch).
Every task: `npx tsc --noEmit`, `npx vite build`, then in `npm run dev` check the demo gallery (~290 items, perPage 4) AND a 6-item gallery: cover → jump to middle → orbit fully around → jump to End → back to Cover. Zero console errors, no blades/frames outside the book silhouette, no blank scenes. R4/R6 additionally: switch all four layouts back and forth five times.
