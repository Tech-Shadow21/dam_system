/**
 * Supabase database types.
 *
 * NOTE: normally produced by
 *   npx supabase gen types typescript --project-id <ref> > types/database.ts
 * Hand-authored here to match supabase/migrations/0001_initial_schema.sql exactly,
 * because no live Supabase project was available at build time. Regenerate from
 * the real project once credentials exist — see memory.md.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type UserRole = 'owner' | 'admin' | 'manager' | 'contributor' | 'viewer'
export type UserStatus = 'active' | 'invited' | 'deactivated'
export type AssetStatus = 'active' | 'archived' | 'deleted'
export type MetadataFieldType = 'text' | 'number' | 'date' | 'select'
export type OrgPlan = 'trial' | 'enterprise'

/**
 * Standalone row shape for `assets`, declared before Database so
 * Functions.search_assets can reference it without a circular type reference
 * (a cycle here silently collapses every row type to `never`).
 */
export interface AssetsRow {
  id: string
  organization_id: string
  folder_id: string | null
  filename: string
  file_type: string
  file_size_bytes: number
  /** Supabase Storage object path (column name retained from the R2 era). */
  r2_key: string
  cdn_url: string | null
  current_version: number
  status: AssetStatus
  uploaded_by: string | null
  metadata: Json
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          plan: OrgPlan
          logo_url: string | null
          brand_primary_color: string | null
          brand_secondary_color: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          plan?: OrgPlan
          logo_url?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          plan?: OrgPlan
          logo_url?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          created_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          organization_id: string
          full_name: string
          email: string
          role: UserRole
          avatar_url: string | null
          status: UserStatus
          created_at: string
        }
        Insert: {
          id: string
          organization_id: string
          full_name?: string
          email: string
          role?: UserRole
          avatar_url?: string | null
          status?: UserStatus
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          full_name?: string
          email?: string
          role?: UserRole
          avatar_url?: string | null
          status?: UserStatus
          created_at?: string
        }
        Relationships: []
      }
      folders: {
        Row: {
          id: string
          organization_id: string
          parent_folder_id: string | null
          name: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          parent_folder_id?: string | null
          name: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          parent_folder_id?: string | null
          name?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      collections: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          id: string
          organization_id: string
          folder_id: string | null
          filename: string
          file_type: string
          file_size_bytes: number
          /** Supabase Storage object path (column name retained from the R2 era). */
          r2_key: string
          cdn_url: string | null
          current_version: number
          status: AssetStatus
          uploaded_by: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          folder_id?: string | null
          filename: string
          file_type: string
          file_size_bytes?: number
          r2_key: string
          cdn_url?: string | null
          current_version?: number
          status?: AssetStatus
          uploaded_by?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          folder_id?: string | null
          filename?: string
          file_type?: string
          file_size_bytes?: number
          r2_key?: string
          cdn_url?: string | null
          current_version?: number
          status?: AssetStatus
          uploaded_by?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      asset_versions: {
        Row: {
          id: string
          asset_id: string
          version_number: number
          r2_key: string
          file_size_bytes: number
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          asset_id: string
          version_number: number
          r2_key: string
          file_size_bytes?: number
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          asset_id?: string
          version_number?: number
          r2_key?: string
          file_size_bytes?: number
          uploaded_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      collection_assets: {
        Row: {
          collection_id: string
          asset_id: string
          added_by: string | null
          added_at: string
        }
        Insert: {
          collection_id: string
          asset_id: string
          added_by?: string | null
          added_at?: string
        }
        Update: {
          collection_id?: string
          asset_id?: string
          added_by?: string | null
          added_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          id: string
          organization_id: string
          name: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
        }
        Relationships: []
      }
      asset_tags: {
        Row: {
          asset_id: string
          tag_id: string
        }
        Insert: {
          asset_id: string
          tag_id: string
        }
        Update: {
          asset_id?: string
          tag_id?: string
        }
        Relationships: []
      }
      metadata_fields: {
        Row: {
          id: string
          organization_id: string
          field_key: string
          label: string
          field_type: MetadataFieldType
          options: Json | null
        }
        Insert: {
          id?: string
          organization_id: string
          field_key: string
          label: string
          field_type: MetadataFieldType
          options?: Json | null
        }
        Update: {
          id?: string
          organization_id?: string
          field_key?: string
          label?: string
          field_type?: MetadataFieldType
          options?: Json | null
        }
        Relationships: []
      }
      share_links: {
        Row: {
          id: string
          organization_id: string
          token: string
          asset_id: string | null
          folder_id: string | null
          collection_id: string | null
          password_hash: string | null
          allow_download: boolean
          expires_at: string
          revoked_at: string | null
          created_by: string | null
          created_at: string
          access_count: number
        }
        Insert: {
          id?: string
          organization_id: string
          token: string
          asset_id?: string | null
          folder_id?: string | null
          collection_id?: string | null
          password_hash?: string | null
          allow_download?: boolean
          expires_at: string
          revoked_at?: string | null
          created_by?: string | null
          created_at?: string
          access_count?: number
        }
        Update: {
          id?: string
          organization_id?: string
          token?: string
          asset_id?: string | null
          folder_id?: string | null
          collection_id?: string | null
          password_hash?: string | null
          allow_download?: boolean
          expires_at?: string
          revoked_at?: string | null
          created_by?: string | null
          created_at?: string
          access_count?: number
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      /** Role-based write gate referenced by RLS policies (03-security-access.md). */
      has_permission: {
        Args: { user_id: string; permission: string }
        Returns: boolean
      }
      /** Current user's organization, used by every tenant-isolation policy. */
      current_organization_id: {
        Args: Record<string, never>
        Returns: string
      }
      current_user_role: {
        Args: Record<string, never>
        Returns: string
      }
      search_assets: {
        Args: {
          p_query: string | null
          p_folder_id: string | null
          p_file_kinds: string[] | null
          p_tag_ids: string[] | null
          p_uploader_id: string | null
          p_date_from: string | null
          p_date_to: string | null
          p_collection_id: string | null
        }
        Returns: AssetsRow[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

/* Convenience row aliases used across the app. */
export type Organization = Database['public']['Tables']['organizations']['Row']
export type UserRecord = Database['public']['Tables']['users']['Row']
export type Folder = Database['public']['Tables']['folders']['Row']
export type Collection = Database['public']['Tables']['collections']['Row']
export type Asset = Database['public']['Tables']['assets']['Row']
export type AssetVersion = Database['public']['Tables']['asset_versions']['Row']
export type Tag = Database['public']['Tables']['tags']['Row']
export type MetadataField = Database['public']['Tables']['metadata_fields']['Row']
export type ShareLink = Database['public']['Tables']['share_links']['Row']
