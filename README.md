<div align="center">

# ✨ Aether Gallery

**Turn any set of image and video links into an immersive, shareable 3D gallery.**

[Live app](https://gallery3-d.vercel.app) · Sphere · Carousel · Masonry

</div>

---

## What it is

Aether Gallery lets anyone build a beautiful gallery in about 30 seconds — no design or code
skills required:

1. **Paste links** — Google Drive images, YouTube / Vimeo videos, or any direct image URL (one per
   line).
2. **Pick a look** — arrange your media as a rotating 3D **Sphere**, a **Carousel** ring, or a
   **Masonry** grid, and tune size, spacing, and radius live.
3. **Share it** — sign in, save once, and get a single link you can send to anyone. Opt into the
   public **Explore** page to reach the wider community.

Each gallery has its own shareable URL (`/?gallery=<slug>`), optional contact buttons
(WhatsApp / email), and a view counter.

## Tech

- **Vite + React 19 + TypeScript**
- **React Three Fiber / three.js** — the WebGL sphere & carousel (no DOM reflow, smooth on mobile)
- **Tailwind** (CDN) for styling
- **Supabase** — auth (Google + email magic-link), a `profiles` users table, and `galleries`
  storage with row-level security and public discovery

## Run locally

**Prerequisites:** Node.js 18+

```bash
npm install
cp .env.example .env.local   # then fill in your values
npm run dev                  # http://localhost:3000
```

### Environment variables (`.env.local`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | yes* | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | yes* | Supabase anon/public key |
| `VITE_GOOGLE_API_KEY` | no | Enables full-resolution Google Drive images in the lightbox |

\* Without Supabase the app still runs — you can build and share galleries via encoded links — but
sign-in, saving, and the Explore page are disabled.

## Supabase schema

The database has two tables under row-level security:

- **`profiles`** — one row per user (`id → auth.users`, `handle`, `display_name`, `avatar_url`,
  `bio`). Auto-created on signup via a trigger.
- **`galleries`** — `slug`, `owner_id`, `items` (jsonb), `settings` (layout jsonb), `is_public`,
  `view_count`, `cover_url`, contact fields. Public galleries are world-readable; only the owner can
  write. View counts are bumped through the `increment_gallery_views(slug)` RPC.

> **Auth setup:** enable the Email provider (on by default) and, optionally, Google OAuth in the
> Supabase dashboard. Add your local (`http://localhost:3000`) and production origins to
> **Authentication → URL Configuration → Redirect URLs**.

## Deploy

Deploys as a static Vite build (e.g. Vercel). Set the same environment variables in your hosting
provider, then `npm run build`.
