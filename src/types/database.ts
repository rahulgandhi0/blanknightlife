export type EventStatus = 'pending' | 'approved' | 'scheduled' | 'posted' | 'archived' | 'discarded'
export type PostType = 'image' | 'carousel'

export interface EventDiscovery {
  id: string
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
  socialbu_account_ids: number[] | null
  engagement_likes: number | null
  engagement_comments: number | null
  engagement_shares: number | null
  created_at: string
  updated_at: string
}

export interface SocialAccount {
  id: string
  socialbu_account_id: number
  platform: 'instagram' | 'tiktok' | 'twitter' | 'facebook' | 'linkedin' | 'youtube'
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
      event_discovery: {
        Row: EventDiscovery
        Insert: Omit<EventDiscovery, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<EventDiscovery, 'id' | 'created_at'>>
      }
      social_accounts: {
        Row: SocialAccount
        Insert: Omit<SocialAccount, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<SocialAccount, 'id' | 'created_at'>>
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}

