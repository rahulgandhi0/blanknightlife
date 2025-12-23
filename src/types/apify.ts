// Apify Instagram Scraper output format
export interface ApifyInstagramPost {
  id: string
  shortCode: string
  url: string
  type: 'Image' | 'Video' | 'Sidecar' // Sidecar = carousel
  caption: string | null
  timestamp: string | null
  displayUrl: string
  images?: string[]
  imageUrl?: string
  imageUrls?: string[]
  videoUrl?: string | null
  ownerUsername: string
  ownerId: string
  likesCount: number
  commentsCount: number
  isPinned?: boolean
  pinned?: boolean
  productType?: string
  takenAt?: string
  takenAtLocal?: string
  takenAtTimestamp?: number
  // For carousels (Sidecar)
  childPosts?: Array<{
    type: 'Image' | 'Video'
    displayUrl: string
    videoUrl?: string | null
  }>
  // Loose catch-all for alternative shapes
  [key: string]: unknown
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

