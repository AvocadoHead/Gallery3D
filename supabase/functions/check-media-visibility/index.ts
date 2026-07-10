// Supabase Edge Function: check-media-visibility
//
// Why this exists: the app renders Google Drive images via
// `https://drive.google.com/thumbnail?id=<id>` from the *owner's own browser*.
// If the owner is logged into Google in that browser, a private file's
// thumbnail loads fine for them even though a stranger (any actual gallery
// visitor) would get a broken image. Checking from the owner's browser can
// never catch this — it has to be checked from somewhere with no Google
// session at all. This function runs server-side, with no cookies, so it
// sees exactly what an anonymous visitor would see.
//
// Request:  POST { driveIds: string[] }
// Response: { results: Record<string, boolean | null> }
//   true  -> publicly viewable (visitors will see it)
//   false -> looks private/inaccessible (visitors will see a broken image)
//   null  -> couldn't determine (network hiccup) — treated as "don't flag"

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_IDS = 60;

async function checkOne(id: string): Promise<boolean | null> {
  try {
    const res = await fetch(`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w800`, {
      method: "GET",
      redirect: "follow",
      headers: {
        // A plain browser-ish UA; no cookies are ever attached to this
        // server-side fetch, which is exactly the point.
        "User-Agent": "Mozilla/5.0 (compatible; AetherGalleryVisibilityCheck/1.0)",
      },
    });
    const contentType = res.headers.get("content-type") || "";
    // A public thumbnail comes back as a real image. A private/missing file
    // redirects to an accounts.google.com sign-in page or an error page —
    // never image/*.
    return res.ok && contentType.startsWith("image/");
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const driveIds: unknown = body?.driveIds;

    if (!Array.isArray(driveIds) || driveIds.length === 0) {
      return new Response(JSON.stringify({ error: "driveIds (non-empty string[]) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = driveIds
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .slice(0, MAX_IDS);

    const uniqueIds = Array.from(new Set(ids));
    const checks = await Promise.all(uniqueIds.map(async (id) => [id, await checkOne(id)] as const));
    const results: Record<string, boolean | null> = Object.fromEntries(checks);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
