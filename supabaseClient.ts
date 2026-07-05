import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { MediaItem } from './constants';
import { Database } from './types/supabase';

export type Visibility = 'private' | 'unlisted' | 'public';

export interface LayoutSettings {
  viewMode?: 'sphere' | 'tile' | 'carousel' | 'canvas' | 'book';
  canvasMode?: 'grid' | 'free';
  bookPerPage?: 1 | 2 | 4;
  mediaScale?: number;
  sphereBase?: number;
  tileGap?: number;
  bgColor?: string;
  shadowOpacity?: number;
  // Gallery-level typography defaults (Phase 4.2); per-item fields override.
  titleFont?: string;
  titleSize?: 'S' | 'M' | 'L' | 'XL';
  titleColor?: string;
}

export interface GalleryRecord {
  id: string;
  slug?: string | null;
  owner_id?: string | null;
  display_name?: string | null;
  contact_whatsapp?: string | null;
  contact_email?: string | null;
  items: MediaItem[];
  visibility?: Visibility;
  /** Read-only mirror of visibility === 'public' (generated column in the DB). */
  is_public?: boolean | null;
  cover_url?: string | null;
  view_count?: number;
  // Frontend-facing name for the layout config.
  layout_settings?: LayoutSettings;
  // The database column is called `settings`; we map between the two below.
  settings?: LayoutSettings | null;
  created_at?: string;
  updated_at?: string;
}

export interface GallerySummary {
  id: string;
  slug: string | null;
  display_name: string | null;
  visibility: Visibility;
  updated_at: string;
  created_at: string | null;
}

/** A public gallery card for the Explore page, with its author's profile. */
export interface PublicGallery {
  id: string;
  slug: string | null;
  display_name: string | null;
  cover_url: string | null;
  view_count: number;
  item_count: number;
  updated_at: string;
  author: {
    handle: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    })
  : null;

export const signInWithGoogle = async (redirectTo?: string) => {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectTo || window.location.origin },
  });
};

export const signInWithEmail = async (email: string, redirectTo?: string) => {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo || window.location.origin },
  });
};

export const signOut = async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
};

const TABLE = 'galleries';
const generateSlug = () => crypto.randomUUID().slice(0, 8);

/** Pick a representative thumbnail for a gallery (used as its Explore cover). */
const deriveCover = (items: MediaItem[]): string | null =>
  items.find((i) => i.previewUrl || i.fallbackPreview)?.previewUrl ||
  items[0]?.fallbackPreview ||
  null;

const mapSettingsToLayout = (record: GalleryRecord): GalleryRecord => {
  if (record.settings) record.layout_settings = record.settings;
  return record;
};

export const saveGalleryRecord = async (
  payload: Omit<GalleryRecord, 'id'> & { id?: string },
  session: Session | null,
  options?: { asNew?: boolean },
) => {
  if (!supabase) throw new Error('Supabase is not configured yet.');

  const slug = options?.asNew ? generateSlug() : payload.slug || generateSlug();
  const ownerId = payload.owner_id || session?.user?.id || null;

  const writePayload = {
    slug,
    owner_id: ownerId,
    display_name: payload.display_name ?? null,
    contact_whatsapp: payload.contact_whatsapp ?? null,
    contact_email: payload.contact_email ?? null,
    items: payload.items as unknown as Database['public']['Tables']['galleries']['Insert']['items'],
    settings: (payload.layout_settings ?? {}) as unknown as Database['public']['Tables']['galleries']['Insert']['settings'],
    // `visibility` drives everything; `is_public` is a generated column now.
    visibility: payload.visibility ?? 'unlisted',
    cover_url: payload.cover_url ?? deriveCover(payload.items),
    updated_at: new Date().toISOString(),
  } as Database['public']['Tables']['galleries']['Insert'];

  if (!options?.asNew && payload.id) {
    writePayload.id = payload.id;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(writePayload, { onConflict: options?.asNew ? undefined : 'id' })
    .select('*')
    .single();

  if (error) throw error;
  return mapSettingsToLayout(data as unknown as GalleryRecord);
};

export const loadGalleryRecord = async (slugOrId: string) => {
  if (!supabase) throw new Error('Supabase is not configured yet.');

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
  let query = supabase.from(TABLE).select('*');

  if (isUUID) {
    query = query.or(`slug.eq.${slugOrId},id.eq.${slugOrId}`);
  } else {
    query = query.eq('slug', slugOrId);
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  return data ? mapSettingsToLayout(data as unknown as GalleryRecord) : null;
};

export const listUserGalleries = async (ownerId: string) => {
  if (!supabase) throw new Error('Supabase is not configured yet.');

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, slug, display_name, visibility, updated_at, created_at')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(50);

  if (error) throw error;
  return (data || []) as unknown as GallerySummary[];
};

/** Flip a single gallery's visibility inline, without reloading + resaving it. */
export const updateGalleryVisibility = async (id: string, visibility: Visibility) => {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  const { error } = await supabase
    .from(TABLE)
    .update({ visibility, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
};

/** Public galleries for the Explore page, with author profile. */
export const listPublicGalleries = async (
  limit = 60,
  sort: 'newest' | 'popular' = 'newest',
): Promise<PublicGallery[]> => {
  if (!supabase) return [];

  const orderCol = sort === 'popular' ? 'view_count' : 'updated_at';

  const { data, error } = await supabase
    .from(TABLE)
    .select(
      'id, slug, display_name, cover_url, view_count, item_count, updated_at, author:profiles!galleries_owner_profile_fkey(handle, display_name, avatar_url)',
    )
    .eq('visibility', 'public')
    .gt('item_count', 0) // Phase 2.3: skip empty galleries
    .not('cover_url', 'is', null) // …and ones without a working cover
    .order(orderCol, { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    slug: row.slug,
    display_name: row.display_name,
    cover_url: row.cover_url,
    view_count: row.view_count ?? 0,
    item_count: row.item_count ?? 0,
    updated_at: row.updated_at,
    author: row.author ?? null,
  }));
};

/** Fire-and-forget view counter for a public gallery. */
export const incrementViews = async (slug: string) => {
  if (!supabase || !slug) return;
  try {
    await supabase.rpc('increment_gallery_views', { gallery_slug: slug });
  } catch {
    /* view counting is best-effort — never block the UI */
  }
};
