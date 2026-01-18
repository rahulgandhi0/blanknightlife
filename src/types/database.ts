export type EventStatus = 'pending' | 'approved' | 'scheduled' | 'posted' | 'archived' | 'discarded'
export type PostType = 'image' | 'carousel' | 'reel'
export type Platform = 'instagram' | 'tiktok' | 'twitter' | 'facebook' | 'linkedin' | 'youtube'
// Frequency is now stored as hours between runs (e.g., 1 = hourly, 24 = daily, 168 = weekly)
export type AutomationRunStatus = 'success' | 'failed' | 'running'

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
  ai_context: string | null
  final_caption: string | null
  media_urls: string[]
  source_media_urls: string[] | null
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

export interface ScrapeAutomation {
  id: string
  profile_id: string
  account_handle: string
  days_back: number
  frequency_hours: number  // Hours between runs (e.g., 1, 6, 12, 24, 48, 168)
  run_at_hour: number      // Initial start hour (UTC)
  run_at_minute: number
  is_active: boolean
  last_run_at: string | null
  last_run_status: AutomationRunStatus | null
  last_run_result: Record<string, unknown> | null
  next_run_at: string | null
  run_count: number
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
          ai_context?: string | null
          final_caption?: string | null
          media_urls: string[]
          source_media_urls?: string[] | null
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
          ai_context?: string | null
          final_caption?: string | null
          media_urls?: string[]
          source_media_urls?: string[] | null
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
      scrape_automations: {
        Row: ScrapeAutomation
        Insert: {
          profile_id: string
          account_handle: string
          days_back?: number
          frequency_hours?: number
          run_at_hour?: number
          run_at_minute?: number
          is_active?: boolean
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          profile_id?: string
          account_handle?: string
          days_back?: number
          frequency_hours?: number
          run_at_hour?: number
          run_at_minute?: number
          is_active?: boolean
          last_run_at?: string | null
          last_run_status?: AutomationRunStatus | null
          last_run_result?: Record<string, unknown> | null
          next_run_at?: string | null
          run_count?: number
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
