import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { MediaItem } from './constants';

export interface GalleryRecord {
  id: string;
  slug?: string | null;
  owner_id?: string | null;
  display_name?: string | null;
  contact_whatsapp?: string | null;
  contact_email?: string | null;
  items: MediaItem[];
  // We keep your preferred name here for the frontend
  layout_settings?: {
    viewMode?: 'sphere' | 'tile' | 'carousel';
    mediaScale?: number;
    sphereBase?: number;
    tileGap?: number;
    bgColor?: string;
    shadowOpacity?: number;
  };
  // The database actually calls this 'settings', so we map it below
  settings?: any; 
  created_at?: string;
  updated_at?: string;
}

export interface GallerySummary {
  id: string;
  slug: string | null;
  display_name: string | null;
  updated_at: string;
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

export const saveGalleryRecord = async (
  payload: Omit<GalleryRecord, 'id'> & { id?: string },
  session: Session | null,
  options?: { asNew?: boolean },
) => {
  if (!supabase) throw new Error('Supabase is not configured yet.');

  const slug = options?.asNew ? generateSlug() : (payload.slug || generateSlug());
  const ownerId = payload.owner_id || session?.user?.id || null;
  
  // MAP Frontend 'layout_settings' to DB 'settings'
  const writePayload: any = {
    slug,
    owner_id: ownerId,
    display_name: payload.display_name,
    contact_whatsapp: payload.contact_whatsapp,
    contact_email: payload.contact_email,
    items: payload.items,
    settings: payload.layout_settings, // <--- CRITICAL MAPPING
    updated_at: new Date().toISOString(),
  };

  if (!options?.asNew && payload.id) {
    writePayload.id = payload.id;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(writePayload, { onConflict: options?.asNew ? undefined : 'id' })
    .select('*')
    .single();

  if (error) throw error;
  
  // Map back for the frontend to use immediately
  const result = data as GalleryRecord;
  if (result.settings) {
    result.layout_settings = result.settings;
  }
  return result;
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
  
  if (data) {
    // MAP DB 'settings' to Frontend 'layout_settings'
    const record = data as GalleryRecord;
    if (record.settings) {
      record.layout_settings = record.settings;
    }
    return record;
  }
  return null;
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
