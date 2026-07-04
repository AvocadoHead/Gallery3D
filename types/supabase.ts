export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      galleries: {
        Row: {
          contact_email: string | null
          contact_whatsapp: string | null
          cover_url: string | null
          created_at: string
          display_name: string | null
          id: string
          is_public: boolean | null
          item_count: number | null
          items: Json
          owner_id: string | null
          settings: Json
          slug: string
          updated_at: string
          view_count: number
          visibility: string
        }
        Insert: {
          contact_email?: string | null
          contact_whatsapp?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          items?: Json
          owner_id?: string | null
          settings?: Json
          slug?: string
          updated_at?: string
          view_count?: number
          visibility?: string
        }
        Update: {
          contact_email?: string | null
          contact_whatsapp?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          items?: Json
          owner_id?: string | null
          settings?: Json
          slug?: string
          updated_at?: string
          view_count?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "galleries_owner_profile_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          handle: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          handle?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          handle?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_gallery_views: {
        Args: { gallery_slug: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
