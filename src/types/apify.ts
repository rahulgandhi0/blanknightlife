// Apify Instagram Scraper output format
export interface ApifyInstagramPost {
  id: string
  shortCode: string
  url: string
  type: 'Image' | 'Video' | 'Sidecar' // Sidecar = carousel
  caption: string | null
  timestamp: string
  displayUrl: string
  images?: string[]
  videoUrl?: string | null
  ownerUsername: string
  ownerId: string
  likesCount: number
  commentsCount: number
  isPinned?: boolean
  // For carousels (Sidecar)
  childPosts?: Array<{
    type: 'Image' | 'Video'
    displayUrl: string
    videoUrl?: string | null
  }>
}

// Apify webhook payload structure
export interface ApifyWebhookPayload {
  resource: {
    defaultDatasetId: string
  }
  eventData: {
    actorRunId: string
  }
}

