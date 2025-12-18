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
  updated_at: string | null;
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
  supabase.auth.getSession().then(({ data }) => cb(data.session ?? null));
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
};

export const signInWithGoogle = async (redirectTo?: string) => {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
};

export const signInWithEmail = async (email: string, redirectTo?: string) => {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
    },
  });
};

export const signOut = async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
};

const TABLE = 'galleries';

const generateSlug = () => crypto.randomUUID().slice(0, 8);

export const saveGalleryRecord = async (
  payload: Omit<GalleryRecord, 'id'> & { id?: string },
  session: Session | null,
  options?: { asNew?: boolean },
) => {
  if (!supabase) throw new Error('Supabase is not configured yet.');

  const slug = options?.asNew ? generateSlug() : payload.slug || generateSlug();
  const ownerId = payload.owner_id || session?.user?.id || null;
  const writePayload = {
    ...payload,
    id: options?.asNew ? undefined : payload.id,
    slug,
    owner_id: ownerId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(writePayload, { onConflict: 'slug' })
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
