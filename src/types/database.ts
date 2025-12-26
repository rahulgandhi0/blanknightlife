export type EventStatus = 'pending' | 'approved' | 'scheduled' | 'posted' | 'archived' | 'discarded'
export type PostType = 'image' | 'carousel'
export type Platform = 'instagram' | 'tiktok' | 'twitter' | 'facebook' | 'linkedin' | 'youtube'

export interface User {
  id: string
  full_name: string
  email: string
  phone: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  user_id: string
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
  user_id: string
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
      users: {
        Row: User
        Insert: Omit<User, 'created_at' | 'updated_at'> & {
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<User, 'id' | 'created_at'>>
      }
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
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
    Functions: {
      get_user_active_profile: {
        Args: { user_uuid: string }
        Returns: string
      }
    }
    Enums: {}
  }
}

