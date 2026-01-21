/**
 * Example API Route with Full Observability
 * 
 * This demonstrates best practices for using the new logging and API wrapper system.
 * 
 * GET /api/example-with-logging?userId=123
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler, createRequestLogger } from '@/lib/api-wrapper';
import { SocialBuClient } from '@/lib/socialbu';

export const GET = withApiHandler(
  async (request: NextRequest, { correlationId }) => {
    // Create a logger with persistent context for this request
    const logger = createRequestLogger(correlationId, { 
      endpoint: 'example-with-logging',
    });

    // Extract query params
    const userId = request.nextUrl.searchParams.get('userId');
    
    logger.info('Processing example request', { userId });

    // Validate input
    if (!userId) {
      logger.warn('Missing required parameter: userId');
      return NextResponse.json(
        { 
          success: false, 
          error: 'userId parameter is required' 
        },
        { status: 400 }
      );
    }

    // Example: Database operation with timing
    logger.debug('Fetching user data from database', { userId });
    const dbTimer = logger.time('Database fetch');
    
    // Simulate database call
    await new Promise(resolve => setTimeout(resolve, 100));
    const userData = { id: userId, name: 'John Doe', email: 'john@example.com' };
    
    dbTimer(); // Logs: "[TIMER END] Database fetch" with durationMs
    logger.info('User data fetched successfully', { userId });

    // Example: External API call with SocialBuClient
    logger.debug('Fetching SocialBu accounts');
    try {
      // Pass correlationId to service for request tracing
      const socialBuClient = new SocialBuClient(undefined, { 
        correlationId,
        userId,
      });
      
      const accounts = await socialBuClient.getAccounts();
      logger.info('SocialBu accounts fetched', { 
        userId,
        accountCount: accounts.length,
      });

      // Return successful response
      return NextResponse.json({
        success: true,
        data: {
          user: userData,
          accounts: accounts.map(acc => ({
            id: acc.id,
            name: acc.name,
            type: acc.type,
          })),
        },
        meta: {
          correlationId, // Include correlation ID in response for debugging
          timestamp: new Date().toISOString(),
        },
      });

    } catch (error) {
      // Specific error handling for known error types
      logger.error('Failed to fetch SocialBu accounts', { userId }, error as Error);
      
      // Return a user-friendly error
      // (The wrapper will catch this and log it, but we can handle it gracefully)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch social media accounts',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  },
  {
    // Optional: Additional wrapper configuration
    context: {
      service: 'example-service',
      version: '1.0.0',
    },
    
    // Optional: Log request body (be careful with sensitive data!)
    logRequestBody: false,
    
    // Optional: Custom error handler (e.g., for sending to Sentry)
    onError: (error, correlationId) => {
      // Example: Send to error tracking service
      // Sentry.captureException(error, { tags: { correlationId } });
      console.error(`Custom error handler for correlation ${correlationId}:`, error);
    },
  }
);

/**
 * Example POST endpoint demonstrating request body logging
 */
export const POST = withApiHandler(
  async (request: NextRequest, { correlationId }) => {
    const logger = createRequestLogger(correlationId, { 
      endpoint: 'example-with-logging',
      method: 'POST',
    });

    // Parse request body
    const body = await request.json();
    logger.debug('Request body received', { 
      hasName: !!body.name,
      hasEmail: !!body.email,
    });

    // Validate
    if (!body.name || !body.email) {
      logger.warn('Invalid request body', { 
        missingFields: [
          !body.name && 'name',
          !body.email && 'email',
        ].filter(Boolean),
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'name and email are required' 
        },
        { status: 400 }
      );
    }

    // Process the request
    logger.info('Creating new resource', { 
      name: body.name,
      email: body.email,
    });

    // Simulate some processing
    await new Promise(resolve => setTimeout(resolve, 200));

    logger.info('Resource created successfully', { 
      resourceId: 'resource_123',
    });

    return NextResponse.json({
      success: true,
      data: {
        id: 'resource_123',
        name: body.name,
        email: body.email,
        createdAt: new Date().toISOString(),
      },
      meta: {
        correlationId,
      },
    });
  },
  {
    // Enable request body logging for POST requests
    // (the wrapper will sanitize sensitive fields automatically)
    logRequestBody: true,
  }
);
