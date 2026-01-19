/**
 * SocialBu API Client
 * 
 * Handles authentication, media uploads, post scheduling, and multi-account management
 * for seamless social media publishing via SocialBu's official API.
 */

const SOCIALBU_API_BASE = 'https://socialbu.com/api/v1';

export interface SocialBuAccount {
  id: number;
  name: string;
  type: 'instagram' | 'tiktok' | 'twitter' | 'facebook' | 'linkedin';
  username: string;
  profile_pic?: string;
  is_active: boolean;
}

export interface MediaUploadResponse {
  signed_url: string;
  key: string;
  upload_token?: string;
}

export interface MediaUploadStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  upload_token?: string;
  error?: string;
}

export interface CreatePostPayload {
  accounts: number[]; // Array of SocialBu account IDs
  content: string; // Caption text
  publish_at?: string; // Format: YYYY-MM-DD HH:MM:SS (UTC)
  existing_attachments?: Array<{ upload_token: string }>; // Array of upload_token objects from media upload
  postback_url?: string; // Webhook URL for status updates
  draft?: boolean; // If true, saves as draft instead of scheduling
  team_id?: number; // Team ID for team-based posting
  queue_ids?: number[]; // Array of queue IDs for queue-based scheduling
  options?: { 
    video_title?: string; 
    comment?: string; 
    [key: string]: any; 
  }; // Additional platform-specific options
}

export interface CreatePostResponse {
  success: boolean;
  post_id?: string;
  message?: string;
  errors?: string[];
}

export interface PostMetrics {
  post_id: string;
  engagements: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  reach?: number;
}

export interface SocialBuPost {
  id: number;
  content: string;
  status: 'scheduled' | 'published' | 'failed' | 'draft';
  published_at?: string;
  scheduled_at?: string;
  account_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * SocialBu API Client Class
 */
export class SocialBuClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SOCIALBU_API_KEY || '';
    this.baseUrl = SOCIALBU_API_BASE;

    if (!this.apiKey) {
      throw new Error('SocialBu API key is required');
    }
  }

  /**
   * Get authorization headers
   */
  private getHeaders(): HeadersInit {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * 1. AUTHENTICATION - Get connected accounts
   * GET /api/v1/accounts
   */
  async getAccounts(): Promise<SocialBuAccount[]> {
    const response = await fetch(`${this.baseUrl}/accounts`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch accounts: ${response.statusText}`);
    }

    const data = await response.json();
    return data.accounts || data || [];
  }

  /**
   * 2. MEDIA UPLOAD - Step 1: Initiate upload
   * POST /upload_media
   */
  async initiateMediaUpload(filename: string, mimeType: string): Promise<MediaUploadResponse> {
    const response = await fetch(`${this.baseUrl}/upload_media`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        name: filename,
        mime_type: mimeType,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to initiate media upload: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 2. MEDIA UPLOAD - Step 2: Upload file to signed URL
   * This uploads the actual file content to SocialBu's storage
   */
  async uploadFileToSignedUrl(signedUrl: string, fileBlob: Blob): Promise<void> {
    const response = await fetch(signedUrl, {
      method: 'PUT',
      body: fileBlob,
      headers: {
        'Content-Type': fileBlob.type,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to upload file to signed URL: ${response.statusText}`);
    }
  }

  /**
   * 2. MEDIA UPLOAD - Step 3: Check upload status and get token
   * GET /api/v1/upload_media/status?key={key}
   */
  async checkMediaUploadStatus(key: string): Promise<MediaUploadStatus> {
    const response = await fetch(`${this.baseUrl}/upload_media/status?key=${key}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to check upload status: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * COMPLETE MEDIA UPLOAD - Handles all 3 steps
   * Takes a URL, downloads it, uploads to SocialBu, returns upload_token
   */
  async uploadMediaFromUrl(mediaUrl: string): Promise<string> {
    try {
      // Step 1: Download the media file
      console.log(`📥 Downloading media from: ${mediaUrl.substring(0, 80)}...`);
      const fileResponse = await fetch(mediaUrl);
      if (!fileResponse.ok) {
        throw new Error(`Failed to download media (HTTP ${fileResponse.status}): ${mediaUrl}`);
      }
      const fileBlob = await fileResponse.blob();
      console.log(`✅ Downloaded ${(fileBlob.size / 1024 / 1024).toFixed(2)}MB (${fileBlob.type})`);
      
      // Extract filename and MIME type
      const urlParts = mediaUrl.split('/');
      const filenameFromUrl = urlParts[urlParts.length - 1] || 'media.jpg';
      // Remove query parameters from filename
      const filename = filenameFromUrl.split('?')[0];
      const mimeType = fileBlob.type || 'image/jpeg';

      // Step 2: Initiate upload with SocialBu
      console.log(`📤 Initiating SocialBu upload for: ${filename}`);
      const { signed_url, key } = await this.initiateMediaUpload(filename, mimeType);
      console.log(`✅ Received signed URL with key: ${key}`);

      // Step 3: Upload file to signed URL with required headers
      console.log('📤 Uploading to signed URL...');
      const uploadResponse = await fetch(signed_url, {
        method: 'PUT',
        body: fileBlob,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': fileBlob.size.toString(),
          'x-amz-acl': 'private',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file to signed URL (HTTP ${uploadResponse.status}): ${uploadResponse.statusText}`);
      }
      console.log('✅ File uploaded to signed URL');

      // Step 4: Poll for completion and get upload_token
      console.log('⏳ Polling for upload completion...');
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max
      
      while (attempts < maxAttempts) {
        const status = await this.checkMediaUploadStatus(key);
        
        if (status.upload_token) {
          console.log(`✅ Upload complete! Token: ${status.upload_token.substring(0, 20)}...`);
          return status.upload_token;
        }
        
        if (status.status === 'failed') {
          throw new Error(`Media upload processing failed in SocialBu: ${status.error || 'Unknown error'}`);
        }

        console.log(`  Poll ${attempts + 1}/${maxAttempts}: status=${status.status}`);
        
        // Wait 1 second before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      throw new Error('Media upload timed out after 30 seconds. SocialBu may be processing the file.');
      
    } catch (error) {
      console.error('❌ Media upload error:', error);
      // Re-throw with more context
      if (error instanceof Error) {
        throw new Error(`Media upload failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 3. CREATE POST - Schedule or publish immediately
   * POST /api/v1/posts
   */
  async createPost(payload: CreatePostPayload): Promise<CreatePostResponse> {
    try {
      console.log('📤 Creating post in SocialBu with payload:', {
        accounts: payload.accounts,
        content_length: payload.content?.length,
        publish_at: payload.publish_at,
        attachments_count: payload.existing_attachments?.length,
        has_options: !!payload.options,
      });
      
      const response = await fetch(`${this.baseUrl}/posts`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      console.log('📥 SocialBu response:', {
        status: response.status,
        ok: response.ok,
        data: data,
      });

      if (!response.ok) {
        // Parse error details from SocialBu response
        let errorMessage = data.message || 'Failed to create post';
        const errors = data.errors || [response.statusText];
        
        // Add more context to common errors
        if (response.status === 401 || response.status === 403) {
          errorMessage = 'Authentication failed with SocialBu API';
        } else if (response.status === 400) {
          errorMessage = `Invalid request: ${data.message || 'Check post parameters'}`;
        } else if (response.status === 422) {
          errorMessage = `Validation error: ${data.message || 'Check media and content'}`;
        }
        
        console.error('❌ SocialBu API error:', { status: response.status, message: errorMessage, errors });
        
        return {
          success: false,
          message: errorMessage,
          errors: errors,
        };
      }

      // Handle multi-account response: SocialBu returns an array of posts for multi-account requests
      // For single account: data.id or data.post_id
      // For multi-account: data.posts (array) - we'll use the first post's ID as primary
      let postId: string | undefined;
      if (data.posts && Array.isArray(data.posts) && data.posts.length > 0) {
        postId = data.posts[0].id || data.posts[0].post_id;
      } else {
        postId = data.id || data.post_id;
      }

      console.log('✅ Post created successfully with ID:', postId);

      return {
        success: true,
        post_id: postId,
        message: 'Post scheduled successfully',
      };
    } catch (error) {
      console.error('❌ Exception creating post:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error creating post',
        errors: [String(error)],
      };
    }
  }

  /**
   * 4. GET POST INSIGHTS - Fetch performance metrics
   * GET /api/v1/insights/posts/metrics
   */
  async getPostMetrics(postId: string): Promise<PostMetrics> {
    const response = await fetch(`${this.baseUrl}/insights/posts/metrics?post_id=${postId}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch post metrics: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 5. GET PUBLISHED POSTS - Fetch recent published posts
   * GET /api/v1/posts?status=published
   */
  async getPublishedPosts(accountId?: number, limit = 50): Promise<SocialBuPost[]> {
    const params = new URLSearchParams({
      type: 'published',
      limit: String(limit),
    });
    if (accountId) {
      params.set('account_id', String(accountId));
    }

    const response = await fetch(`${this.baseUrl}/posts?${params}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch published posts: ${response.statusText}`);
    }

    const data = await response.json();
    return data.posts || data || [];
  }

  /**
   * 6. GET SCHEDULED POSTS - Fetch pending scheduled posts
   * GET /api/v1/posts?status=scheduled
   */
  async getScheduledPosts(accountId?: number, limit = 50): Promise<SocialBuPost[]> {
    const params = new URLSearchParams({
      type: 'scheduled',
      limit: String(limit),
    });
    if (accountId) {
      params.set('account_id', String(accountId));
    }

    const response = await fetch(`${this.baseUrl}/posts?${params}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch scheduled posts: ${response.statusText}`);
    }

    const data = await response.json();
    return data.posts || data || [];
  }

  /**
   * 7. GET POST BY ID - Fetch a single post
   * GET /api/v1/posts/{postId}
   */
  async getPost(postId: number | string): Promise<SocialBuPost> {
    const response = await fetch(`${this.baseUrl}/posts/${postId}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch post: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 8. UPDATE POST - Update post content, schedule time, media, or other fields
   * PATCH /api/v1/posts/{postId}
   */
  async updatePost(
    postId: number | string,
    updates: {
      content?: string;
      publish_at?: string; // Format: YYYY-MM-DD HH:MM:SS (UTC)
      accounts?: number[];
      existing_attachments?: string[]; // Array of upload tokens to replace media
      team_id?: number;
      options?: { 
        video_title?: string; 
        comment?: string; 
        [key: string]: any; 
      };
    }
  ): Promise<{ success: boolean; message?: string }> {
    const response = await fetch(`${this.baseUrl}/posts/${postId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(updates),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Failed to update post',
      };
    }

    return {
      success: true,
      message: data.message || 'Post updated successfully',
    };
  }

  /**
   * 9. DELETE POST - Delete a scheduled post
   * DELETE /api/v1/posts/{postId}
   */
  async deletePost(postId: number | string): Promise<{ success: boolean; message?: string }> {
    const response = await fetch(`${this.baseUrl}/posts/${postId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Failed to delete post',
      };
    }

    return {
      success: true,
      message: data.message || 'Post deleted successfully',
    };
  }

  /**
   * CONVENIENCE METHOD: Schedule a post with media
   * Handles the complete flow: upload media → create post
   */
  async schedulePostWithMedia(
    accountIds: number[],
    caption: string,
    mediaUrls: string[],
    scheduledAt: Date,
    options?: { 
      share_reel_to_feed?: boolean;
      thumbnail?: string;
      [key: string]: any;
    },
    postbackUrl?: string
  ): Promise<CreatePostResponse> {
    // Upload all media files in parallel and get tokens
    const uploadTokens = await Promise.all(
      mediaUrls.map(async (mediaUrl) => {
        const token = await this.uploadMediaFromUrl(mediaUrl);
        return { upload_token: token };
      })
    );

    // Format date as YYYY-MM-DD HH:MM:SS (UTC)
    const publish_at = scheduledAt.toISOString().slice(0, 19).replace('T', ' ');

    // Create the post
    return await this.createPost({
      accounts: accountIds,
      content: caption,
      publish_at,
      existing_attachments: uploadTokens,
      options, // Pass platform-specific options
      postback_url: postbackUrl,
    });
  }
}

/**
 * Singleton instance for convenience
 */
export const socialBuClient = new SocialBuClient();

