/**
 * SocialBu API Client
 * 
 * Handles authentication, media uploads, post scheduling, and multi-account management
 * for seamless social media publishing via SocialBu's official API.
 */

import { logger, LogContext } from './logger';

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
  private context: LogContext;

  constructor(apiKey?: string, context?: LogContext) {
    this.apiKey = apiKey || process.env.SOCIALBU_API_KEY || '';
    this.baseUrl = SOCIALBU_API_BASE;
    this.context = context || {};

    if (!this.apiKey) {
      const error = new Error('SocialBu API key is required');
      logger.error('SocialBuClient initialization failed', this.context, error);
      throw error;
    }

    logger.debug('SocialBuClient initialized', {
      ...this.context,
      baseUrl: this.baseUrl,
    });
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
   * Sanitize API key for logging (show first 4 chars only)
   */
  private sanitizeApiKey(key: string): string {
    return key.length > 4 ? `${key.substring(0, 4)}${'*'.repeat(12)}` : '***';
  }

  /**
   * Enhanced fetch wrapper with timing, logging, and error handling
   */
  private async fetchWithLogging(
    url: string,
    options: RequestInit,
    operationName: string
  ): Promise<Response> {
    const startTime = Date.now();
    const method = options.method || 'GET';
    
    // Log request at DEBUG level
    logger.debug(`[SocialBu API] ${operationName} - Request`, {
      ...this.context,
      method,
      url,
      hasBody: !!options.body,
    });

    // Log request body at DEBUG level (sanitized)
    if (options.body && typeof options.body === 'string') {
      try {
        const bodyObj = JSON.parse(options.body);
        logger.debug(`[SocialBu API] ${operationName} - Request body`, {
          ...this.context,
          body: bodyObj,
        });
      } catch {
        // Not JSON, skip logging body
      }
    }

    try {
      const response = await fetch(url, options);
      const durationMs = Date.now() - startTime;

      // Log response
      if (response.ok) {
        logger.info(`[SocialBu API] ${operationName} - Success`, {
          ...this.context,
          method,
          url,
          statusCode: response.status,
          durationMs,
        });
      } else {
        // Clone response to read body without consuming it
        const responseClone = response.clone();
        let errorBody: any;
        try {
          errorBody = await responseClone.json();
        } catch {
          errorBody = await responseClone.text();
        }

        logger.error(`[SocialBu API] ${operationName} - Failed`, {
          ...this.context,
          method,
          url,
          statusCode: response.status,
          durationMs,
          responseBody: errorBody,
        });
      }

      return response;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      logger.error(`[SocialBu API] ${operationName} - Network error`, {
        ...this.context,
        method,
        url,
        durationMs,
      }, error as Error);
      throw error;
    }
  }

  /**
   * 1. AUTHENTICATION - Get connected accounts
   * GET /api/v1/accounts
   */
  async getAccounts(): Promise<SocialBuAccount[]> {
    const response = await this.fetchWithLogging(
      `${this.baseUrl}/accounts`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      },
      'getAccounts'
    );

    if (!response.ok) {
      const errorBody = await response.text();
      const error = new Error(`Failed to fetch accounts: ${response.statusText}`);
      logger.error('Failed to fetch SocialBu accounts', {
        ...this.context,
        statusCode: response.status,
        errorBody,
      }, error);
      throw error;
    }

    const data = await response.json();
    const accounts = data.accounts || data || [];
    
    logger.info('Successfully fetched SocialBu accounts', {
      ...this.context,
      accountCount: accounts.length,
    });
    
    return accounts;
  }

  /**
   * 2. MEDIA UPLOAD - Step 1: Initiate upload
   * POST /upload_media
   */
  async initiateMediaUpload(filename: string, mimeType: string): Promise<MediaUploadResponse> {
    const response = await this.fetchWithLogging(
      `${this.baseUrl}/upload_media`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          name: filename,
          mime_type: mimeType,
        }),
      },
      'initiateMediaUpload'
    );

    if (!response.ok) {
      const errorBody = await response.text();
      const error = new Error(`Failed to initiate media upload: ${response.statusText}`);
      logger.error('Failed to initiate media upload', {
        ...this.context,
        filename,
        mimeType,
        statusCode: response.status,
        errorBody,
      }, error);
      throw error;
    }

    return await response.json();
  }

  /**
   * 2. MEDIA UPLOAD - Step 2: Upload file to signed URL
   * This uploads the actual file content to SocialBu's storage
   */
  async uploadFileToSignedUrl(signedUrl: string, fileBlob: Blob): Promise<void> {
    const startTime = Date.now();
    logger.debug('[SocialBu API] uploadFileToSignedUrl - Starting', {
      ...this.context,
      fileSizeMB: (fileBlob.size / 1024 / 1024).toFixed(2),
      fileType: fileBlob.type,
    });

    const response = await fetch(signedUrl, {
      method: 'PUT',
      body: fileBlob,
      headers: {
        'Content-Type': fileBlob.type,
      },
    });

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const error = new Error(`Failed to upload file to signed URL: ${response.statusText}`);
      logger.error('Failed to upload file to signed URL', {
        ...this.context,
        statusCode: response.status,
        durationMs,
      }, error);
      throw error;
    }

    logger.info('[SocialBu API] File uploaded to signed URL', {
      ...this.context,
      durationMs,
      fileSizeMB: (fileBlob.size / 1024 / 1024).toFixed(2),
    });
  }

  /**
   * 2. MEDIA UPLOAD - Step 3: Check upload status and get token
   * GET /api/v1/upload_media/status?key={key}
   */
  async checkMediaUploadStatus(key: string): Promise<MediaUploadStatus> {
    const response = await this.fetchWithLogging(
      `${this.baseUrl}/upload_media/status?key=${key}`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      },
      'checkMediaUploadStatus'
    );

    if (!response.ok) {
      const errorBody = await response.text();
      const error = new Error(`Failed to check upload status: ${response.statusText}`);
      logger.error('Failed to check upload status', {
        ...this.context,
        key,
        statusCode: response.status,
        errorBody,
      }, error);
      throw error;
    }

    return await response.json();
  }

  /**
   * COMPLETE MEDIA UPLOAD - Handles all 3 steps
   * Takes a URL, downloads it, uploads to SocialBu, returns upload_token
   */
  async uploadMediaFromUrl(mediaUrl: string): Promise<string> {
    const startTime = Date.now();
    logger.info('[SocialBu] Starting complete media upload', {
      ...this.context,
      mediaUrl: mediaUrl.substring(0, 100),
    });

    try {
      // Step 1: Download the media file
      logger.debug('[SocialBu] Step 1: Downloading media', {
        ...this.context,
        mediaUrl: mediaUrl.substring(0, 100),
      });
      
      const fileResponse = await fetch(mediaUrl);
      if (!fileResponse.ok) {
        throw new Error(`Failed to download media (HTTP ${fileResponse.status}): ${mediaUrl}`);
      }
      const fileBlob = await fileResponse.blob();
      
      logger.info('[SocialBu] Media downloaded successfully', {
        ...this.context,
        fileSizeMB: (fileBlob.size / 1024 / 1024).toFixed(2),
        fileType: fileBlob.type,
      });
      
      // Extract filename and MIME type
      const urlParts = mediaUrl.split('/');
      const filenameFromUrl = urlParts[urlParts.length - 1] || 'media.jpg';
      // Remove query parameters from filename
      const filename = filenameFromUrl.split('?')[0];
      const mimeType = fileBlob.type || 'image/jpeg';

      // Step 2: Initiate upload with SocialBu
      logger.debug('[SocialBu] Step 2: Initiating SocialBu upload', {
        ...this.context,
        filename,
        mimeType,
      });
      
      const { signed_url, key } = await this.initiateMediaUpload(filename, mimeType);
      
      logger.debug('[SocialBu] Received signed URL', {
        ...this.context,
        key,
      });

      // Step 3: Upload file to signed URL with required headers
      logger.debug('[SocialBu] Step 3: Uploading to signed URL', {
        ...this.context,
        key,
      });
      
      const uploadStartTime = Date.now();
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
      
      logger.info('[SocialBu] File uploaded to signed URL', {
        ...this.context,
        durationMs: Date.now() - uploadStartTime,
      });

      // Step 4: Poll for completion and get upload_token
      logger.debug('[SocialBu] Step 4: Polling for upload completion', {
        ...this.context,
        key,
      });
      
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max
      
      while (attempts < maxAttempts) {
        const status = await this.checkMediaUploadStatus(key);
        
        if (status.upload_token) {
          const totalDurationMs = Date.now() - startTime;
          logger.info('[SocialBu] Upload complete! Token received', {
            ...this.context,
            uploadToken: status.upload_token.substring(0, 20) + '...',
            totalDurationMs,
            attempts: attempts + 1,
          });
          return status.upload_token;
        }
        
        if (status.status === 'failed') {
          throw new Error(`Media upload processing failed in SocialBu: ${status.error || 'Unknown error'}`);
        }

        logger.debug(`[SocialBu] Poll ${attempts + 1}/${maxAttempts}`, {
          ...this.context,
          status: status.status,
        });
        
        // Wait 1 second before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      throw new Error('Media upload timed out after 30 seconds. SocialBu may be processing the file.');
      
    } catch (error) {
      const totalDurationMs = Date.now() - startTime;
      logger.error('[SocialBu] Media upload failed', {
        ...this.context,
        totalDurationMs,
        mediaUrl: mediaUrl.substring(0, 100),
      }, error as Error);
      
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
      logger.info('[SocialBu] Creating post', {
        ...this.context,
        accounts: payload.accounts,
        contentLength: payload.content?.length,
        publishAt: payload.publish_at,
        attachmentsCount: payload.existing_attachments?.length,
        hasOptions: !!payload.options,
      });
      
      const response = await this.fetchWithLogging(
        `${this.baseUrl}/posts`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(payload),
        },
        'createPost'
      );

      const data = await response.json();
      
      logger.debug('[SocialBu] Create post response received', {
        ...this.context,
        status: response.status,
        ok: response.ok,
        hasData: !!data,
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
        
        logger.error('[SocialBu] Create post failed', {
          ...this.context,
          statusCode: response.status,
          errorMessage,
          errors,
          responseData: data,
        });
        
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

      logger.info('[SocialBu] Post created successfully', {
        ...this.context,
        postId,
      });

      return {
        success: true,
        post_id: postId,
        message: 'Post scheduled successfully',
      };
    } catch (error) {
      logger.error('[SocialBu] Exception creating post', {
        ...this.context,
      }, error as Error);
      
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
    const response = await this.fetchWithLogging(
      `${this.baseUrl}/insights/posts/metrics?post_id=${postId}`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      },
      'getPostMetrics'
    );

    if (!response.ok) {
      const errorBody = await response.text();
      const error = new Error(`Failed to fetch post metrics: ${response.statusText}`);
      logger.error('Failed to fetch post metrics', {
        ...this.context,
        postId,
        statusCode: response.status,
        errorBody,
      }, error);
      throw error;
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

    const response = await this.fetchWithLogging(
      `${this.baseUrl}/posts?${params}`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      },
      'getPublishedPosts'
    );

    if (!response.ok) {
      const errorBody = await response.text();
      const error = new Error(`Failed to fetch published posts: ${response.statusText}`);
      logger.error('Failed to fetch published posts', {
        ...this.context,
        accountId,
        limit,
        statusCode: response.status,
        errorBody,
      }, error);
      throw error;
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

    const response = await this.fetchWithLogging(
      `${this.baseUrl}/posts?${params}`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      },
      'getScheduledPosts'
    );

    if (!response.ok) {
      const errorBody = await response.text();
      const error = new Error(`Failed to fetch scheduled posts: ${response.statusText}`);
      logger.error('Failed to fetch scheduled posts', {
        ...this.context,
        accountId,
        limit,
        statusCode: response.status,
        errorBody,
      }, error);
      throw error;
    }

    const data = await response.json();
    return data.posts || data || [];
  }

  /**
   * 7. GET POST BY ID - Fetch a single post
   * GET /api/v1/posts/{postId}
   */
  async getPost(postId: number | string): Promise<SocialBuPost> {
    const response = await this.fetchWithLogging(
      `${this.baseUrl}/posts/${postId}`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      },
      'getPost'
    );

    if (!response.ok) {
      const errorBody = await response.text();
      const error = new Error(`Failed to fetch post: ${response.statusText}`);
      logger.error('Failed to fetch post', {
        ...this.context,
        postId,
        statusCode: response.status,
        errorBody,
      }, error);
      throw error;
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
    logger.info('[SocialBu] Updating post', {
      ...this.context,
      postId,
      hasContent: !!updates.content,
      hasPublishAt: !!updates.publish_at,
    });

    const response = await this.fetchWithLogging(
      `${this.baseUrl}/posts/${postId}`,
      {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(updates),
      },
      'updatePost'
    );

    const data = await response.json();

    if (!response.ok) {
      logger.error('[SocialBu] Update post failed', {
        ...this.context,
        postId,
        statusCode: response.status,
        responseData: data,
      });
      
      return {
        success: false,
        message: data.message || 'Failed to update post',
      };
    }

    logger.info('[SocialBu] Post updated successfully', {
      ...this.context,
      postId,
    });

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
    logger.info('[SocialBu] Deleting post', {
      ...this.context,
      postId,
    });

    const response = await this.fetchWithLogging(
      `${this.baseUrl}/posts/${postId}`,
      {
        method: 'DELETE',
        headers: this.getHeaders(),
      },
      'deletePost'
    );

    const data = await response.json();

    if (!response.ok) {
      logger.error('[SocialBu] Delete post failed', {
        ...this.context,
        postId,
        statusCode: response.status,
        responseData: data,
      });
      
      return {
        success: false,
        message: data.message || 'Failed to delete post',
      };
    }

    logger.info('[SocialBu] Post deleted successfully', {
      ...this.context,
      postId,
    });

    return {
      success: true,
      message: data.message || 'Post deleted successfully',
    };
  }

  /**
   * CONVENIENCE METHOD: Schedule a post with media
   * Handles the complete flow: upload media ? create post
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

