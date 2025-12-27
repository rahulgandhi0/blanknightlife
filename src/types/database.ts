export type EventStatus = 'pending' | 'approved' | 'scheduled' | 'posted' | 'archived' | 'discarded'
export type PostType = 'image' | 'carousel'
export type Platform = 'instagram' | 'tiktok' | 'twitter' | 'facebook' | 'linkedin' | 'youtube'

export interface Profile {
  id: string
  name: string
  handle: string | null
  avatar_url: string | null
  socialbu_account_id: number
  platform: Platform
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EventDiscovery {
  id: string
  profile_id: string
  status: EventStatus
  source_account: string
  post_type: PostType
  original_caption: string | null
  ai_generated_caption: string | null
  final_caption: string | null
  media_urls: string[]
  ig_post_id: string
  is_pinned: boolean
  posted_at_source: string | null
  scheduled_for: string | null
  posted_at: string | null
  meta_post_id: string | null
  socialbu_post_id: number | null
  socialbu_account_ids: number[] | null
  engagement_likes: number | null
  engagement_comments: number | null
  engagement_shares: number | null
  created_at: string
  updated_at: string
}

export interface SocialAccount {
  id: string
  profile_id: string
  socialbu_account_id: number
  platform: Platform
  account_name: string
  username: string
  is_active: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: {
          name: string
          handle?: string | null
          avatar_url?: string | null
          socialbu_account_id: number
          platform: Platform
          is_active: boolean
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          handle?: string | null
          avatar_url?: string | null
          socialbu_account_id?: number
          platform?: Platform
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      event_discovery: {
        Row: EventDiscovery
        Insert: {
          profile_id: string
          status: EventStatus
          source_account: string
          post_type: PostType
          original_caption?: string | null
          ai_generated_caption?: string | null
          final_caption?: string | null
          media_urls: string[]
          ig_post_id: string
          is_pinned?: boolean
          posted_at_source?: string | null
          scheduled_for?: string | null
          posted_at?: string | null
          meta_post_id?: string | null
          socialbu_account_ids?: number[] | null
          engagement_likes?: number | null
          engagement_comments?: number | null
          engagement_shares?: number | null
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          profile_id?: string
          status?: EventStatus
          source_account?: string
          post_type?: PostType
          original_caption?: string | null
          ai_generated_caption?: string | null
          final_caption?: string | null
          media_urls?: string[]
          ig_post_id?: string
          is_pinned?: boolean
          posted_at_source?: string | null
          scheduled_for?: string | null
          posted_at?: string | null
          meta_post_id?: string | null
          socialbu_account_ids?: number[] | null
          engagement_likes?: number | null
          engagement_comments?: number | null
          engagement_shares?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      social_accounts: {
        Row: SocialAccount
        Insert: {
          profile_id: string
          socialbu_account_id: number
          platform: Platform
          account_name: string
          username: string
          is_active?: boolean
          is_default?: boolean
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          profile_id?: string
          socialbu_account_id?: number
          platform?: Platform
          account_name?: string
          username?: string
          is_active?: boolean
          is_default?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
