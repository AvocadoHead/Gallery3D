# Aether Gallery — Launch Sprint

*Fable, 2026-07-07. Four phases to public launch, ordered so each is shippable alone. P1/P2 are minutes, P3 is an hour, P4 is the real feature. Standing guardrails from git history still apply (no per-frame camera writes, galleryItems is the save source of truth, book flip math is prototype-locked — tune only constants).*

**Known issue accepted for launch:** occasional page intersection in very thick books. Covered by the Beta badge (P1); revisit post-launch (next lever: raise the `leafZ` cushion from 3→5 leaves, or bump `fanDegPerLeaf` total cap 12°→16°).

---

## P1 — "Beta" tag on the Book toggle *(XS)*

Both places the Book layout is offered:
1. `App.tsx` header pill (the `onClick={() => setViewMode('book')}` button): render `Book` plus a tiny superscript chip inside the button:
   ```jsx
   Book <span className="ml-0.5 text-[8px] font-black uppercase tracking-wide text-amber-500 align-super">beta</span>
   ```
   (When the button is active/dark, amber-400 stays legible — verify contrast in both states.)
2. `components/BuilderModal.tsx` Look tab — the Book layout card gets the same chip next to its label.

Accept: both Book buttons show a small "beta" that doesn't change button height; screenshot both states.

## P2 — Demo gallery carries Eyal's contact *(XS)*

In `App.tsx` → `syncFromQuery`, the no-param fallback branch (`setGalleryItems(buildDefaultMediaItems())`) additionally sets:
```ts
setContactWhatsapp('97236030603');
setContactEmail('eyalizenman@gmail.com');
```
ONLY in that branch — `handleStartNew` and loaded galleries must stay untouched (verify: Start New clears both; loading a saved gallery shows its own contacts). The existing Contact bubble (bottom-right) then offers WhatsApp + Email on the demo.

Accept: fresh visit → demo gallery → Contact shows both channels; Start New → contact empty.

## P3 — Terms of Service + Accessibility Statement *(S)*

**Content note for Eyal: these are drafts, not legal advice — have a lawyer glance before launch (and consider a Hebrew version; Israeli regulations expect an accessibility statement for local service sites).**

1. New `components/LegalModal.tsx`: a modal with two tabs ("Terms", "Accessibility"), scrollable prose, opened via `?page=terms` / `?page=accessibility` deep links AND footer links. Add links in: `Landing.tsx` footer (small, under the how-it-works strip) and BuilderModal Support tab.
2. **Terms draft — key clauses** (write as readable prose, not legalese):
   - Aether Gallery displays media from links users paste; it does not host, copy, or store the media itself — galleries are collections of references, like sharing a playlist.
   - Users are solely responsible for content they link and share, must hold the rights to it, and must not link unlawful, infringing, or harmful material.
   - We do not pre-screen or monitor linked content and are not responsible for it (analogous to any platform displaying user-shared URLs); we may remove galleries or accounts on notice of abuse, at our discretion.
   - Takedown/abuse contact: eyalizenman@gmail.com — include what to send (gallery link + reason).
   - Service is provided "as is", no warranty; features may change; accounts violating the terms may be removed.
   - Privacy line: we store your email (login), profile, and galleries in Supabase (EU region); no ads, no selling data; view counters are anonymous.
3. **Accessibility statement draft**: commitment to WCAG 2.1 AA where feasible; honest statement that the 3D layouts (sphere/carousel/book) are visual experiences not fully screen-reader accessible, and that **Masonry is the accessible alternative** (semantic DOM, keyboard scrolling, alt text from item titles); lightbox reachable by click; known gaps (keyboard navigation of 3D scenes) and the contact for accessibility issues (same email). While in there: give the lightbox close button an `aria-label`, the layout pills `aria-pressed`, and item titles as `alt` (mostly already done).

Accept: `?page=terms` opens the modal directly; both texts render on mobile; links visible on Landing without scrolling past the fold on desktop.

## P4 — Gallery feedback: a quiet communication hub *(M — the real feature)*

Design goals from Eyal, translated: logged-in users can leave thoughts on any **saved** gallery; messages are **private to the gallery owner by default**; a message appears publicly only when BOTH the author allowed it and the owner chose to display it; **no emails ever**; it should feel like a guestbook, not a comment section.

### P4a — Schema + RLS (migration on the Aether Supabase project, `ojdskkpiwwvdzmtkoxvv`)
```sql
create table public.gallery_feedback (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  author_allows_public boolean not null default false, -- author: "owner may display this"
  owner_published boolean not null default false,      -- owner: "display on my gallery"
  created_at timestamptz not null default now()
);
alter table public.gallery_feedback enable row level security;
```
Policies (write them exactly; then run `get_advisors` security):
- INSERT: `auth.uid() = author_id` (authenticated role only).
- SELECT: `auth.uid() = author_id` OR `auth.uid() = (select owner_id from galleries g where g.id = gallery_id)` OR `(author_allows_public and owner_published)`.
- UPDATE (owner flips `owner_published` only — enforce via a column-limited policy or a `security definer` RPC `set_feedback_published(feedback_id, published)` that checks gallery ownership; the RPC is simpler and safer): owner of the gallery.
- UPDATE (author edits `body`/`author_allows_public` on own message within… keep simple: author can update own rows).
- DELETE: author OR gallery owner.
- Regenerate `types/supabase.ts` via MCP `generate_typescript_types`.

### P4b — Client API (`supabaseClient.ts`)
`listPublicFeedback(galleryId)` (public rows, with author profile join), `listFeedbackForOwner(galleryId)`, `sendFeedback(galleryId, body, allowsPublic)`, `setFeedbackPublished(id, published)` (RPC), `deleteFeedback(id)`. Follow the existing function style; every function guards `if (!supabase) …`.

### P4c — Viewer side: "Leave a note" drawer
- In the gallery header (App.tsx), next to Explore, show a small "Notes" button only when `savedGalleryId` exists.
- Drawer (right side, like the builder's visual language): top = published notes (author name + text, newest first, empty-state: "No public notes yet"); bottom = compose box for signed-in users with a checkbox **"Allow the owner to share this note publicly"** (default OFF) and copy above it: *"Your note goes privately to the gallery owner."* Signed-out users see a sign-in nudge instead of the composer.
- After send: clear box, toast "Sent to the gallery owner". No other notification of any kind.

### P4d — Owner side: inbox in the builder
- New "Notes" tab in BuilderModal (only when signed in): list of the CURRENT gallery's feedback — private ones marked 🔒, each with: publish toggle (disabled with tooltip "Author kept this private" unless `author_allows_public`), delete.
- Small unread affordance: show count of notes newer than `localStorage['notesSeen:<galleryId>']`; update on open. (localStorage is fine here — it's a nicety, not state of record.)

Accept (full flow, two accounts): user B leaves a private note on A's gallery → B sees it in their own view only, A sees it in the inbox, anonymous visitors see nothing; B leaves a second note with "allow public" → A publishes it → visible to signed-out visitors in the drawer; A cannot publish the first note; deletes work both sides; `get_advisors` shows no new security findings; no email is sent anywhere.

---

## Order & verification

P1 → P2 → P3 → P4 (a→d strictly). Each phase: `npx tsc --noEmit` + `npx vite build` green, then manual check of that phase's Accept line. P4a additionally: `get_advisors` (security) before and after. Ship P1–P3 immediately; P4 behind a normal deploy when the full Accept flow passes.
