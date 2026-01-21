/**
 * API Route Wrapper for Next.js
 * 
 * Provides:
 * - Unique correlation IDs for request tracing
 * - Automatic request/response logging
 * - Centralized error handling with stack traces
 * - Performance timing for all routes
 * - Standardized error responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger, LogContext } from './logger';

/**
 * Generate a unique correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Standardized error response structure
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  correlationId: string;
  timestamp: string;
  details?: any;
}

/**
 * Extract sanitized request information
 */
function getRequestInfo(request: NextRequest): {
  method: string;
  url: string;
  userAgent: string;
  searchParams: Record<string, string>;
} {
  const url = request.url;
  const method = request.method;
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  // Extract search params as object
  const searchParams: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    searchParams[key] = value;
  });

  return { method, url, userAgent, searchParams };
}

/**
 * Sanitize sensitive data from objects (API keys, tokens, passwords)
 */
function sanitizeObject(obj: any, depth = 0): any {
  if (depth > 3 || obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    const sensitiveKeys = [
      'password',
      'api_key',
      'apiKey',
      'apikey',
      'token',
      'secret',
      'authorization',
      'auth',
      'bearer',
      'api-key',
    ];

    for (const [key, value] of Object.entries(obj)) {
      const keyLower = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(sk => keyLower.includes(sk));
      
      if (isSensitive && typeof value === 'string') {
        // Show first 4 chars and mask the rest
        sanitized[key] = value.length > 4 
          ? `${value.substring(0, 4)}${'*'.repeat(Math.min(value.length - 4, 20))}`
          : '***';
      } else {
        sanitized[key] = sanitizeObject(value, depth + 1);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Options for the API wrapper
 */
export interface ApiHandlerOptions {
  /**
   * Additional context to include in all logs for this handler
   */
  context?: LogContext;

  /**
   * Whether to log request body (default: false, as it may contain sensitive data)
   */
  logRequestBody?: boolean;

  /**
   * Custom error handler
   */
  onError?: (error: Error, correlationId: string) => void;
}

/**
 * Type for Next.js API route handlers
 */
export type NextApiHandler = (
  request: NextRequest,
  context?: any
) => Promise<NextResponse> | NextResponse;

/**
 * Higher-order function to wrap API routes with observability
 * 
 * Usage:
 * ```ts
 * export const GET = withApiHandler(async (request) => {
 *   // Your handler code
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
export function withApiHandler(
  handler: (request: NextRequest, context: { correlationId: string }) => Promise<NextResponse>,
  options: ApiHandlerOptions = {}
): NextApiHandler {
  return async (request: NextRequest) => {
    const correlationId = generateCorrelationId();
    const startTime = Date.now();
    
    // Extract request information
    const { method, url, userAgent, searchParams } = getRequestInfo(request);
    
    // Create base context for all logs in this request
    const baseContext: LogContext = {
      correlationId,
      method,
      url,
      userAgent,
      ...options.context,
    };

    // Log incoming request
    logger.info('Incoming API request', {
      ...baseContext,
      searchParams: Object.keys(searchParams).length > 0 ? searchParams : undefined,
    });

    // Optionally log request body (only if explicitly enabled)
    if (options.logRequestBody) {
      try {
        const contentType = request.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const bodyClone = request.clone();
          const body = await bodyClone.json();
          logger.debug('Request body', {
            ...baseContext,
            body: sanitizeObject(body),
          });
        }
      } catch (error) {
        // Ignore body parsing errors
        logger.debug('Could not parse request body', baseContext);
      }
    }

    try {
      // Execute the actual handler
      const response = await handler(request, { correlationId });
      
      // Calculate execution time
      const durationMs = Date.now() - startTime;
      
      // Log successful response
      logger.info('API request completed', {
        ...baseContext,
        statusCode: response.status,
        durationMs,
      });

      // Add correlation ID to response headers for client-side debugging
      response.headers.set('X-Correlation-ID', correlationId);
      
      return response;
      
    } catch (error) {
      // Calculate execution time
      const durationMs = Date.now() - startTime;
      
      // Determine if this is a known error type
      const err = error instanceof Error ? error : new Error(String(error));
      
      // Log the error with full context
      logger.error('API request failed', {
        ...baseContext,
        durationMs,
        statusCode: 500,
        errorMessage: err.message,
        errorName: err.name,
      }, err);

      // Call custom error handler if provided
      if (options.onError) {
        try {
          options.onError(err, correlationId);
        } catch (handlerError) {
          logger.error('Error handler failed', baseContext, handlerError as Error);
        }
      }

      // Return standardized error response
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: err.message || 'An unexpected error occurred',
        correlationId,
        timestamp: new Date().toISOString(),
      };

      // In development, include stack trace
      if (process.env.NODE_ENV === 'development') {
        errorResponse.details = {
          stack: err.stack,
          name: err.name,
        };
      }

      const response = NextResponse.json(errorResponse, { status: 500 });
      response.headers.set('X-Correlation-ID', correlationId);
      
      return response;
    }
  };
}

/**
 * Alias for more semantic naming
 */
export const withDebug = withApiHandler;

/**
 * Create a child logger with correlation ID for use within handlers
 */
export function createRequestLogger(correlationId: string, additionalContext?: LogContext) {
  return logger.child({
    correlationId,
    ...additionalContext,
  });
}
