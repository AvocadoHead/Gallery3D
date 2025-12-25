import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { MediaItem } from './constants';

/**
 * Expected Supabase table (public.galleries):
 * - id: uuid (primary key, default uuid_generate_v4())
 * - slug: text (unique)
 * - owner_id: uuid (index for listing per user)
 * - display_name: text
 * - contact_whatsapp: text
 * - contact_email: text
 * - items: jsonb
 * - created_at: timestamptz (default now())
 * - updated_at: timestamptz
 */

export interface GalleryRecord {
  id: string;
  slug?: string | null;
  owner_id?: string | null;
  display_name?: string | null;
  contact_whatsapp?: string | null;
  contact_email?: string | null;
  items: MediaItem[];
  created_at?: string;
  updated_at?: string;
}

export interface GallerySummary {
  id: string;
  slug: string | null;
  display_name: string | null;
  updated_at: string; // Enforced as string because we sort by it
  created_at: string | null;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const listenToAuth = (cb: (session: Session | null) => void) => {
  if (!supabase) return () => {};

  // 1. Get initial session
  supabase.auth.getSession().then(({ data }) => cb(data.session ?? null));

  // 2. Listen for changes
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session);
    // NOTE: We removed the URL cleaning logic here.
    // We let App.tsx detect the #access_token to open the Builder UI first.
  });

  return () => data.subscription.unsubscribe();
};

export const signInWithGoogle = async (redirectTo?: string) => {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  
  // Ensure we redirect back to the app root or specific page
  const redirectUrl = redirectTo || (typeof window !== 'undefined' ? window.location.origin : undefined);

  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUrl },
  });
};

export const signInWithEmail = async (email: string, redirectTo?: string) => {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  
  const redirectUrl = redirectTo || (typeof window !== 'undefined' ? window.location.origin : undefined);

  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectUrl,
    },
  });
};

export const signOut = async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
};

const TABLE = 'galleries';

// Generate a short random string for slugs
const generateSlug = () => crypto.randomUUID().slice(0, 8);

export const saveGalleryRecord = async (
  payload: Omit<GalleryRecord, 'id'> & { id?: string },
  session: Session | null,
  options?: { asNew?: boolean },
) => {
  if (!supabase) throw new Error('Supabase is not configured yet.');

  // Logic: 
  // 1. If 'asNew' is true -> Generate new Slug, Remove ID (force insert)
  // 2. If 'asNew' is false -> Use existing Slug/ID if available, else generate new
  
  const slug = options?.asNew ? generateSlug() : (payload.slug || generateSlug());
  const ownerId = payload.owner_id || session?.user?.id || null;

  // Prepare the object for DB
  const writePayload: any = {
    ...payload,
    slug,
    owner_id: ownerId,
    updated_at: new Date().toISOString(),
  };

  // Vital: Delete the ID if we want a new record so Postgres generates a new UUID
  if (options?.asNew) {
    delete writePayload.id;
  } else {
    // If we have an ID, keep it to ensure we update the specific row
    writePayload.id = payload.id; 
  }

  // We use Upsert based on ID if present, otherwise it might rely on Slug uniqueness
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(writePayload, { onConflict: options?.asNew ? undefined : 'id' }) 
    .select('*')
    .single();

  if (error) throw error;
  return data as GalleryRecord;
};

export const loadGalleryRecord = async (slugOrId: string) => {
  if (!supabase) throw new Error('Supabase is not configured yet.');

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    // Search by Slug OR ID
    .or(`slug.eq.${slugOrId},id.eq.${slugOrId}`)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as GalleryRecord | null;
};

export const listUserGalleries = async (ownerId: string) => {
  if (!supabase) throw new Error('Supabase is not configured yet.');

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, slug, display_name, updated_at, created_at')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(50);

  if (error) throw error;
  return (data || []) as GallerySummary[];
};
