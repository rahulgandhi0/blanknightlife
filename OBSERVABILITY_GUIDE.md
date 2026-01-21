# Observability & Debugging Guide

This guide explains the production-grade observability and debugging system implemented in this Next.js application.

## Overview

The system consists of three main components:

1. **Structured Logger** (`src/lib/logger.ts`) - Centralized logging with levels and context
2. **API Wrapper** (`src/lib/api-wrapper.ts`) - Request tracing and error handling for API routes
3. **Instrumented Services** - Services like `SocialBuClient` with performance monitoring

## Features

### ✅ Log Levels
- `DEBUG`: Detailed diagnostic information
- `INFO`: General informational messages
- `WARN`: Warning messages for potential issues
- `ERROR`: Error events with full stack traces

### ✅ Development vs Production
- **Development**: Pretty-printed, colorful logs with emojis
- **Production**: Structured JSON logs for log aggregation tools (e.g., Datadog, CloudWatch, Splunk)

### ✅ Request Tracing
- Every API request gets a unique `correlationId`
- All logs within a request include the same `correlationId`
- Correlation IDs are returned in response headers (`X-Correlation-ID`)

### ✅ Performance Timing
- Automatic timing for API routes
- Timing for external API calls (e.g., SocialBu)
- Duration logged in milliseconds

### ✅ Error Handling
- Centralized error catching in API routes
- Full stack traces logged
- Standardized error responses
- Sensitive data (API keys, tokens) automatically sanitized

---

## 1. Using the Logger

### Basic Usage

```typescript
import { logger } from '@/lib/logger';

// Simple log messages
logger.debug('Checking cache...');
logger.info('User logged in successfully');
logger.warn('Rate limit approaching');
logger.error('Payment processing failed', undefined, error);
```

### With Context

```typescript
import { logger } from '@/lib/logger';

logger.info('Post created', {
  userId: '123',
  postId: 'abc-456',
  platform: 'instagram',
});

logger.error('API call failed', {
  correlationId: 'xyz-789',
  url: 'https://api.example.com/posts',
  statusCode: 500,
}, error);
```

### Child Logger (Persistent Context)

```typescript
import { logger } from '@/lib/logger';

// Create a child logger with persistent context
const userLogger = logger.child({ userId: '123', service: 'auth' });

// All logs from this child will include userId and service
userLogger.info('Login attempt'); // Includes { userId: '123', service: 'auth' }
userLogger.error('Login failed', { reason: 'invalid_password' }, error); 
// Includes { userId: '123', service: 'auth', reason: 'invalid_password' }
```

### Timing Operations

```typescript
import { logger } from '@/lib/logger';

const endTimer = logger.time('Database query', { query: 'SELECT * FROM posts' });
// ... perform operation
endTimer(); // Logs: "[TIMER END] Database query" with durationMs
```

---

## 2. API Route Wrapper

### Wrapping API Routes

Use `withApiHandler` to wrap your Next.js API routes for automatic observability:

```typescript
// Before (old way)
export async function GET(request: NextRequest) {
  try {
    // ... your code
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// After (with observability)
import { withApiHandler } from '@/lib/api-wrapper';

export const GET = withApiHandler(async (request, { correlationId }) => {
  // Your code here - errors are automatically caught and logged
  // correlationId is automatically generated and available
  
  return NextResponse.json({ success: true });
});
```

### Using the Request Logger

```typescript
import { withApiHandler, createRequestLogger } from '@/lib/api-wrapper';

export const POST = withApiHandler(async (request, { correlationId }) => {
  const logger = createRequestLogger(correlationId, { 
    endpoint: 'create-post',
    userId: 'user_123',
  });

  logger.info('Creating new post');
  
  // ... your logic
  
  logger.info('Post created successfully', { postId: 'post_456' });
  
  return NextResponse.json({ success: true });
});
```

### Advanced Options

```typescript
import { withApiHandler } from '@/lib/api-wrapper';

export const POST = withApiHandler(
  async (request, { correlationId }) => {
    // Your handler code
    return NextResponse.json({ success: true });
  },
  {
    // Log request body (be careful with sensitive data)
    logRequestBody: true,
    
    // Persistent context for all logs in this route
    context: { 
      endpoint: 'payments',
      service: 'billing',
    },
    
    // Custom error handler
    onError: (error, correlationId) => {
      // Send to error tracking service (e.g., Sentry)
      console.error('Custom error handler:', error);
    },
  }
);
```

---

## 3. Instrumented Services

### SocialBuClient Example

The `SocialBuClient` is now fully instrumented with logging:

```typescript
import { SocialBuClient } from '@/lib/socialbu';

// Pass correlation ID for request tracing
const client = new SocialBuClient(undefined, { 
  correlationId: 'abc-123',
  userId: 'user_456',
});

// All API calls are automatically logged with:
// - URL and method
// - Request/response timing
// - Success/error status
// - Full error context on failures

const accounts = await client.getAccounts();
// Logs:
// [DEBUG] [SocialBu API] getAccounts - Request
// [INFO] [SocialBu API] getAccounts - Success (durationMs: 245, statusCode: 200)
// [INFO] Successfully fetched SocialBu accounts (accountCount: 3)
```

---

## 4. Environment Configuration

### Set Log Level

Control which logs are output using the `LOG_LEVEL` environment variable:

```bash
# .env or .env.local
LOG_LEVEL=DEBUG  # Show all logs (DEBUG, INFO, WARN, ERROR)
LOG_LEVEL=INFO   # Show INFO, WARN, ERROR (default in production)
LOG_LEVEL=WARN   # Show only WARN and ERROR
LOG_LEVEL=ERROR  # Show only ERROR
```

If not set:
- **Development**: Defaults to `DEBUG`
- **Production**: Defaults to `INFO`

---

## 5. Production JSON Log Format

In production (`NODE_ENV=production`), logs are output as single-line JSON:

```json
{
  "timestamp": "2026-01-20T15:30:45.123Z",
  "level": "INFO",
  "message": "[SocialBu API] getAccounts - Success",
  "context": {
    "correlationId": "1737390645123-x8k2m",
    "method": "GET",
    "url": "https://socialbu.com/api/v1/accounts",
    "statusCode": 200,
    "durationMs": 245
  }
}
```

This format is compatible with:
- **AWS CloudWatch** - Use JSON filter patterns
- **Datadog** - Automatic parsing and indexing
- **Splunk** - JSON source type
- **Elasticsearch/ELK** - Direct indexing
- **Google Cloud Logging** - Structured logs

---

## 6. Error Tracking

### Automatic Error Context

When an error occurs in an API route wrapped with `withApiHandler`, the following is automatically logged:

- Full error message and stack trace
- `correlationId` for tracing
- Request URL, method, and headers (user agent)
- Request duration until error
- HTTP status code

### Error Response Format

Clients receive standardized error responses:

```json
{
  "success": false,
  "error": "Failed to fetch accounts: Unauthorized",
  "correlationId": "1737390645123-x8k2m",
  "timestamp": "2026-01-20T15:30:45.123Z",
  "details": {  // Only in development
    "stack": "Error: Unauthorized\n  at SocialBuClient.getAccounts...",
    "name": "Error"
  }
}
```

The `correlationId` in the response can be used to search logs for the full error context.

---

## 7. Debug Endpoint Example

The enhanced `/api/debug-socialbu` endpoint demonstrates the observability system:

### Basic Usage

```bash
curl http://localhost:3000/api/debug-socialbu
```

Returns account analysis with automatic logging.

### Verbose Mode

```bash
curl http://localhost:3000/api/debug-socialbu?verbose=true
```

Returns the same analysis PLUS a `logs` array showing the step-by-step execution:

```json
{
  "success": true,
  "socialbu_accounts": [...],
  "profiles": [...],
  "mismatches": [...],
  "logs": [
    "[2026-01-20T15:30:45.123Z] Starting SocialBu debug analysis",
    "[2026-01-20T15:30:45.234Z] Fetching SocialBu accounts...",
    "[2026-01-20T15:30:45.456Z] Fetched 3 SocialBu accounts",
    "[2026-01-20T15:30:45.567Z] Fetching profiles from database...",
    "[2026-01-20T15:30:45.678Z] Fetched 5 profiles from database",
    "[2026-01-20T15:30:45.789Z] Analyzing profile-account matches...",
    "[2026-01-20T15:30:45.890Z] MATCH: Profile 'Main' -> SocialBu account 'Instagram Main'",
    "[2026-01-20T15:30:45.901Z] Analysis complete: 5 total profiles, 0 mismatches"
  ]
}
```

This is extremely helpful for frontend debugging!

---

## 8. Best Practices

### ✅ DO

- **Always pass `correlationId`** when creating service instances in API routes
- **Use child loggers** for operations that share common context
- **Log at appropriate levels**: DEBUG for diagnostics, INFO for key events, ERROR for failures
- **Include meaningful context** in logs (user IDs, resource IDs, etc.)
- **Use the timer helper** for performance-critical operations
- **Wrap all API routes** with `withApiHandler`

### ❌ DON'T

- **Don't log sensitive data** (passwords, full API keys, credit card numbers)
- **Don't use `console.log`** directly - use the logger
- **Don't log at DEBUG level in tight loops** - it will impact performance
- **Don't ignore the `correlationId`** - it's essential for tracing
- **Don't catch and swallow errors** without logging them

---

## 9. Migration Checklist

To upgrade existing API routes to use the new system:

- [ ] Replace `console.log` with `logger.info` or `logger.debug`
- [ ] Replace `console.error` with `logger.error`
- [ ] Wrap the route handler with `withApiHandler`
- [ ] Create a request logger with `createRequestLogger`
- [ ] Pass `correlationId` to service constructors
- [ ] Test the route and verify logs appear correctly
- [ ] Check that error handling works (trigger an error intentionally)
- [ ] Verify the `X-Correlation-ID` header is present in responses

---

## 10. Troubleshooting

### Logs not appearing in production

1. Check `NODE_ENV` is set to `production`
2. Check `LOG_LEVEL` isn't set to a restrictive level (e.g., `ERROR`)
3. Verify your hosting platform is capturing stdout logs

### Colors not showing in development

1. Verify `NODE_ENV` is NOT `production`
2. Check your terminal supports ANSI color codes
3. Try a different terminal if colors still don't appear

### Correlation IDs not matching

1. Ensure you're passing `correlationId` to service constructors
2. Check that child loggers inherit the correlation ID correctly
3. Verify the `X-Correlation-ID` header in the response matches the logs

---

## Summary

This observability system provides enterprise-grade debugging and monitoring capabilities:

- **Structured logging** for easy searching and filtering
- **Request tracing** with correlation IDs across services
- **Performance monitoring** with automatic timing
- **Production-ready** with JSON logging for aggregation tools
- **Developer-friendly** with colorful, readable logs in development

Start by wrapping your API routes with `withApiHandler` and using the `logger` instead of `console.log`!
