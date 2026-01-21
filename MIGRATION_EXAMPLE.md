# Migration Example: Upgrading an API Route

This document shows how to upgrade an existing API route to use the new observability system.

## Example: `/api/socialbu-schedule`

### ❌ BEFORE (Current Implementation)

```typescript
/**
 * POST /api/socialbu-schedule
 */
import { NextRequest, NextResponse } from 'next/server';
import { SocialBuClient } from '@/lib/socialbu';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, accountIds } = body;

    // Validation
    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Fetch event from database
    const supabase = await createClient();
    const { data: event, error: fetchError } = await supabase
      .from('event_discovery')
      .select('*')
      .eq('id', eventId)
      .single();

    if (fetchError || !event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Upload media to SocialBu
    console.log('Uploading media...');  // ❌ Basic console.log
    const client = new SocialBuClient();
    const uploadTokens = await Promise.all(
      event.media_urls.map(url => client.uploadMediaFromUrl(url))
    );

    // Schedule post
    console.log('Creating post in SocialBu...');  // ❌ Basic console.log
    const result = await client.schedulePostWithMedia(
      accountIds,
      event.final_caption,
      event.media_urls,
      new Date(event.scheduled_for)
    );

    if (!result.success) {
      console.error('Failed to schedule post:', result.message);  // ❌ Basic console.error
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 500 }
      );
    }

    // Update database
    await supabase
      .from('event_discovery')
      .update({ 
        status: 'scheduled',
        socialbu_post_id: result.post_id,
      })
      .eq('id', eventId);

    console.log('Post scheduled successfully!');  // ❌ Basic console.log

    return NextResponse.json({
      success: true,
      postId: result.post_id,
    });

  } catch (error) {
    console.error('Error scheduling post:', error);  // ❌ Basic error handling
    return NextResponse.json(
      { success: false, error: 'Failed to schedule post' },
      { status: 500 }
    );
  }
}
```

### ✅ AFTER (With Observability)

```typescript
/**
 * POST /api/socialbu-schedule
 */
import { NextRequest, NextResponse } from 'next/server';
import { SocialBuClient } from '@/lib/socialbu';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, createRequestLogger } from '@/lib/api-wrapper';

export const POST = withApiHandler(
  async (request: NextRequest, { correlationId }) => {
    // ✅ Create logger with correlation ID and context
    const logger = createRequestLogger(correlationId, { 
      endpoint: 'socialbu-schedule',
    });

    const body = await request.json();
    const { eventId, accountIds } = body;

    logger.info('Processing schedule request', { eventId, accountIds });

    // Validation
    if (!eventId) {
      logger.warn('Missing required parameter', { field: 'eventId' });
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Fetch event from database
    logger.debug('Fetching event from database', { eventId });
    const dbTimer = logger.time('Database fetch');
    
    const supabase = await createClient();
    const { data: event, error: fetchError } = await supabase
      .from('event_discovery')
      .select('*')
      .eq('id', eventId)
      .single();
    
    dbTimer(); // ✅ Logs duration

    if (fetchError || !event) {
      logger.warn('Event not found', { eventId });
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    logger.info('Event fetched successfully', { 
      eventId, 
      status: event.status,
      mediaCount: event.media_urls?.length || 0,
    });

    // Upload media to SocialBu
    logger.info('Starting media upload', { 
      eventId,
      mediaCount: event.media_urls?.length || 0,
    });
    
    // ✅ Pass correlation ID to service for tracing
    const client = new SocialBuClient(undefined, { 
      correlationId,
      eventId,
    });
    
    const uploadTimer = logger.time('Media upload');
    const uploadTokens = await Promise.all(
      event.media_urls.map(url => client.uploadMediaFromUrl(url))
    );
    uploadTimer(); // ✅ Logs total upload duration
    
    logger.info('All media uploaded', { 
      eventId,
      uploadedCount: uploadTokens.length,
    });

    // Schedule post
    logger.info('Creating post in SocialBu', { 
      eventId,
      accountIds,
      scheduledFor: event.scheduled_for,
    });
    
    const result = await client.schedulePostWithMedia(
      accountIds,
      event.final_caption,
      event.media_urls,
      new Date(event.scheduled_for)
    );

    if (!result.success) {
      // ✅ Detailed error context automatically logged by SocialBuClient
      logger.error('Failed to schedule post in SocialBu', {
        eventId,
        errorMessage: result.message,
        errors: result.errors,
      });
      
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 500 }
      );
    }

    logger.info('Post scheduled in SocialBu', { 
      eventId,
      postId: result.post_id,
    });

    // Update database
    logger.debug('Updating event status in database', { eventId });
    const updateTimer = logger.time('Database update');
    
    await supabase
      .from('event_discovery')
      .update({ 
        status: 'scheduled',
        socialbu_post_id: result.post_id,
      })
      .eq('id', eventId);
    
    updateTimer(); // ✅ Logs duration

    logger.info('Post scheduled successfully', { 
      eventId,
      postId: result.post_id,
    });

    return NextResponse.json({
      success: true,
      postId: result.post_id,
      meta: {
        correlationId, // ✅ Include for client-side debugging
      },
    });
  },
  {
    // ✅ Optional: Additional configuration
    context: { 
      service: 'socialbu-integration',
      operation: 'schedule-post',
    },
  }
);
```

---

## 🎯 Key Improvements

### 1. **Automatic Error Handling**
- No need for try-catch - the wrapper handles it
- Full stack traces automatically logged
- Standardized error responses

### 2. **Request Tracing**
- Every request gets a unique `correlationId`
- Correlation ID flows through all services
- Easy to find all logs for a specific request

### 3. **Performance Monitoring**
- Automatic timing of the entire request
- Custom timers for specific operations (DB queries, uploads)
- Durations logged in milliseconds

### 4. **Rich Context**
- Every log includes relevant data (eventId, accountIds, etc.)
- Context flows through the entire request
- Easy to filter logs by any field

### 5. **Better Debugging**
- Development: Colorful, readable logs
- Production: Structured JSON for log tools
- Verbose logging at DEBUG level
- Clear progression through the operation

---

## 📊 Log Output Comparison

### Before (scattered console.logs)
```
Uploading media...
Creating post in SocialBu...
Post scheduled successfully!
```
**Issues:**
- No timestamps
- No context (which event? which user?)
- Can't trace across requests
- Not searchable in production

### After (structured logging in development)
```
ℹ️  15:30:45 INFO   Processing schedule request
    Context: eventId: evt_123, accountIds: [456, 789], correlationId: abc-123

🔍 15:30:45 DEBUG  Fetching event from database
    Context: eventId: evt_123, correlationId: abc-123

🔍 15:30:45 DEBUG  [TIMER END] Database fetch
    Context: durationMs: 45ms, correlationId: abc-123

ℹ️  15:30:45 INFO   Event fetched successfully
    Context: eventId: evt_123, status: approved, mediaCount: 2, correlationId: abc-123

ℹ️  15:30:45 INFO   Starting media upload
    Context: eventId: evt_123, mediaCount: 2, correlationId: abc-123

ℹ️  15:30:47 INFO   All media uploaded
    Context: eventId: evt_123, uploadedCount: 2, correlationId: abc-123

🔍 15:30:47 DEBUG  [TIMER END] Media upload
    Context: durationMs: 2340ms, correlationId: abc-123

ℹ️  15:30:47 INFO   Post scheduled successfully
    Context: eventId: evt_123, postId: post_999, correlationId: abc-123
```

### After (structured logging in production)
```json
{"timestamp":"2026-01-20T15:30:45.123Z","level":"INFO","message":"Processing schedule request","context":{"eventId":"evt_123","accountIds":[456,789],"correlationId":"abc-123"}}
{"timestamp":"2026-01-20T15:30:45.168Z","level":"DEBUG","message":"[TIMER END] Database fetch","context":{"durationMs":45,"correlationId":"abc-123"}}
{"timestamp":"2026-01-20T15:30:45.170Z","level":"INFO","message":"Event fetched successfully","context":{"eventId":"evt_123","status":"approved","mediaCount":2,"correlationId":"abc-123"}}
{"timestamp":"2026-01-20T15:30:47.510Z","level":"INFO","message":"Post scheduled successfully","context":{"eventId":"evt_123","postId":"post_999","correlationId":"abc-123"}}
```
**Benefits:**
- Searchable by any field
- Filterable by correlation ID
- Timestamped for ordering
- Ready for log aggregation tools

---

## ✅ Migration Checklist

When upgrading an API route:

- [ ] Import `withApiHandler` and `createRequestLogger`
- [ ] Wrap the handler function with `withApiHandler`
- [ ] Extract `correlationId` from handler params
- [ ] Create a logger with `createRequestLogger`
- [ ] Replace `console.log` with `logger.info` or `logger.debug`
- [ ] Replace `console.error` with `logger.error`
- [ ] Add context to log calls (IDs, status, counts)
- [ ] Use `logger.time()` for performance-critical operations
- [ ] Pass `correlationId` to service constructors
- [ ] Add correlation ID to successful responses (optional but helpful)
- [ ] Remove try-catch blocks (wrapper handles errors)
- [ ] Test the route and verify logs

---

## 🎓 Tips for Good Logging

### DO ✅
```typescript
// Include relevant IDs and counts
logger.info('Media uploaded', { eventId, mediaCount: 5 });

// Use different log levels appropriately
logger.debug('Detailed state', { state }); // Only in dev
logger.info('Key event', { userId }); // Important milestones
logger.warn('Potential issue', { value }); // Warnings
logger.error('Operation failed', { details }, error); // Errors with full context

// Time expensive operations
const timer = logger.time('Expensive operation');
await expensiveOperation();
timer();

// Add child loggers for shared context
const userLogger = logger.child({ userId: '123' });
userLogger.info('Action 1'); // Auto-includes userId
userLogger.info('Action 2'); // Auto-includes userId
```

### DON'T ❌
```typescript
// Don't log sensitive data
logger.info('User login', { password: '...' }); // ❌ Never log passwords

// Don't use console directly
console.log('Debug info'); // ❌ Use logger.debug()

// Don't log in tight loops (impacts performance)
for (let i = 0; i < 10000; i++) {
  logger.debug('Processing item', { i }); // ❌ Too verbose
}

// Don't log without context
logger.info('Operation completed'); // ❌ No useful information
```

---

## 🚀 Next Steps

1. **Start with high-traffic routes**: Migrate your most-used API endpoints first
2. **Monitor logs**: Check that logs appear correctly in development
3. **Test errors**: Trigger errors to verify error handling works
4. **Production deploy**: Deploy and verify JSON logs in production
5. **Set up aggregation**: Configure Datadog/CloudWatch to ingest logs
6. **Create dashboards**: Visualize key metrics and errors

---

## 📚 Resources

- See `OBSERVABILITY_GUIDE.md` for complete usage documentation
- See `src/app/api/example-with-logging/route.ts` for a full working example
- See `src/app/api/debug-socialbu/route.ts` for the upgraded debug endpoint
