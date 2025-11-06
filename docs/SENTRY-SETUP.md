# Sentry Error Monitoring Setup Guide

## Overview

**Sentry** is integrated into this project to provide real-time error monitoring and performance tracking in production. It helps you:

- 🐛 Catch errors before users report them
- 📊 Track error frequency and impact
- 🔍 Get detailed stack traces and context
- 📈 Monitor application performance
- 🚨 Receive alerts for critical issues

## What Gets Tracked

### Client-Side (Browser)
- JavaScript errors and unhandled promises
- React component errors
- Network failures
- User sessions (with privacy filters)
- Performance metrics

### Server-Side (Next.js)
- API route errors
- Server-side rendering errors
- Database query failures (Prisma)
- Unhandled exceptions
- Performance bottlenecks

### Edge Runtime
- Middleware errors
- Edge function failures

## Setup Instructions

### 1. Create Sentry Account

1. Go to [sentry.io](https://sentry.io) and sign up
2. Create a new project:
   - **Platform**: Next.js
   - **Project Name**: ultimatepos-modern
   - **Team**: Your organization name

### 2. Get Your DSN

After creating the project, Sentry will provide a **DSN** (Data Source Name):

```
https://abc123def456@o123456.ingest.sentry.io/7654321
```

### 3. Configure Environment Variables

Add to your `.env.local` file:

```env
# Sentry Configuration
SENTRY_DSN=https://your-dsn-here@sentry.io/project-id
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn-here@sentry.io/project-id

# Optional: Auth token for source map uploads
SENTRY_AUTH_TOKEN=your-auth-token-here
SENTRY_ORG=your-organization-slug
SENTRY_PROJECT=ultimatepos-modern
```

### 4. Configure Vercel (Production)

In your Vercel dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add:
   - `SENTRY_DSN`
   - `NEXT_PUBLIC_SENTRY_DSN`
   - `SENTRY_AUTH_TOKEN` (optional, for source maps)
   - `SENTRY_ORG`
   - `SENTRY_PROJECT`

3. Redeploy your application

## Configuration Files

The project includes three Sentry configuration files:

### 1. `sentry.client.config.ts` (Browser)
- Captures client-side errors
- Tracks user sessions
- Filters sensitive data
- Ignores browser extension errors

### 2. `sentry.server.config.ts` (Server)
- Captures API errors
- Tracks Prisma queries
- Filters sensitive data (passwords, tokens)
- Ignores known Prisma errors

### 3. `sentry.edge.config.ts` (Edge Runtime)
- Captures middleware errors
- Tracks edge function failures

## Testing Sentry Integration

### Test Error Capture

Create a test error to verify Sentry is working:

```typescript
// Add this to any page temporarily
function TestSentryError() {
  return (
    <button onClick={() => {
      throw new Error("Sentry test error!");
    }}>
      Test Sentry
    </button>
  )
}
```

Click the button and check your Sentry dashboard within 1-2 minutes.

### Test API Error

```bash
# Make a request to a test error endpoint
curl http://localhost:3000/api/test-sentry-error
```

## Privacy & Data Filtering

### Automatic Filtering

Sentry is configured to automatically filter:

✅ **Headers**:
- Authorization
- Cookie
- Set-Cookie

✅ **Query Parameters**:
- token
- password
- secret
- api_key

✅ **User Data**:
- Email addresses
- Personal information

✅ **Session Replay**:
- All text (masked)
- All media (blocked)

### Custom Filtering

To add more filters, edit `sentry.server.config.ts`:

```typescript
beforeSend(event) {
  // Custom filtering logic
  if (event.request?.headers) {
    delete event.request.headers['X-Custom-Secret'];
  }
  return event;
}
```

## Alert Configuration

### Recommended Alerts

1. **Critical Errors**
   - **Trigger**: Error count > 10 in 5 minutes
   - **Action**: Email + Slack notification
   - **Priority**: High

2. **Performance Degradation**
   - **Trigger**: Response time > 2 seconds
   - **Action**: Email
   - **Priority**: Medium

3. **New Error Types**
   - **Trigger**: First occurrence of new error
   - **Action**: Slack notification
   - **Priority**: Medium

### Setup Alerts in Sentry

1. Go to **Alerts** → **Create Alert**
2. Choose alert type (e.g., "Issues")
3. Set conditions (e.g., "Error count > 10")
4. Choose notification channel (Email, Slack, PagerDuty)
5. Save and test

## Monitoring Dashboard

### Key Metrics to Watch

1. **Error Rate**
   - Target: < 0.1% of requests
   - Critical: > 1%

2. **Response Time**
   - Target: < 500ms (API)
   - Critical: > 2s

3. **Crash-Free Sessions**
   - Target: > 99.9%
   - Critical: < 99%

4. **Top Errors**
   - Review daily
   - Fix critical issues within 24h

### Sentry Dashboard Views

1. **Issues**: List of all errors
2. **Performance**: Response times and bottlenecks
3. **Releases**: Track errors by deployment
4. **Discover**: Custom queries and analytics

## Best Practices

### DO ✅

- ✅ Set up alerts for critical errors
- ✅ Review Sentry dashboard daily
- ✅ Tag releases with version numbers
- ✅ Add context to errors (user ID, tenant ID)
- ✅ Filter sensitive data
- ✅ Set error sampling (10-100% based on traffic)

### DON'T ❌

- ❌ Log passwords or tokens
- ❌ Ignore repeated errors
- ❌ Set sampling too low in production
- ❌ Disable Sentry in production
- ❌ Expose DSN in client code (use NEXT_PUBLIC_ prefix)

## Adding Context to Errors

### In Components

```typescript
import * as Sentry from "@sentry/nextjs";

try {
  // Your code
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      section: 'sales',
      action: 'create-transaction'
    },
    extra: {
      transactionId: transaction.id,
      userId: session.user.id,
      businessId: session.user.businessId
    }
  });
}
```

### In API Routes

```typescript
import * as Sentry from "@sentry/nextjs";

export async function POST(request: Request) {
  try {
    // Your API logic
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        endpoint: '/api/sales',
        method: 'POST'
      },
      extra: {
        requestBody: await request.json()
      }
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Performance Monitoring

### Enable Performance Tracking

Performance monitoring is enabled by default with `tracesSampleRate: 1.0`.

### Track Custom Transactions

```typescript
import * as Sentry from "@sentry/nextjs";

const transaction = Sentry.startTransaction({
  name: "Process Sale Transaction",
  op: "transaction",
});

try {
  // Your code
  const span = transaction.startChild({ op: "database.query" });
  // Database operation
  span.finish();
} finally {
  transaction.finish();
}
```

## Troubleshooting

### Sentry Not Capturing Errors

1. **Check DSN is set**:
   ```bash
   echo $SENTRY_DSN
   echo $NEXT_PUBLIC_SENTRY_DSN
   ```

2. **Check environment**:
   - Sentry may be disabled in development
   - Check `environment` in config

3. **Check filters**:
   - Error might be filtered by `ignoreErrors`
   - Check `beforeSend` logic

### Too Many Errors

1. **Increase filtering**:
   - Add more patterns to `ignoreErrors`
   - Filter by error message

2. **Reduce sample rate**:
   ```typescript
   tracesSampleRate: 0.1  // 10% of transactions
   ```

3. **Set up rate limiting**:
   - Configure in Sentry dashboard
   - Limit: 1000 errors/hour

## Cost Management

### Free Tier Limits
- **Errors**: 5,000/month
- **Performance**: 10,000 transactions/month
- **Session Replay**: 50 sessions/month

### Optimize Costs

1. **Sample errors** (if high traffic):
   ```typescript
   tracesSampleRate: 0.1  // 10%
   ```

2. **Filter noise**:
   - Ignore expected errors
   - Filter development errors

3. **Disable session replay** (if not needed):
   - Remove `replayIntegration`

## Integration with CI/CD

Sentry is automatically integrated with the CI/CD pipeline:

```yaml
# .github/workflows/ci.yml
- name: Upload source maps to Sentry
  run: npx @sentry/cli releases finalize ${{ github.sha }}
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
```

This enables:
- Source map uploads for better stack traces
- Release tracking
- Commit association

## Support

### Documentation
- [Sentry Next.js Guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Error Tracking](https://docs.sentry.io/product/issues/)

### Community
- [Sentry Discord](https://discord.gg/sentry)
- [GitHub Issues](https://github.com/getsentry/sentry-javascript/issues)

## Related Documentation
- [CI/CD Setup](./CICD-SETUP.md)
- [Production Deployment](./DEPLOYMENT.md)
- [Environment Variables](./ENVIRONMENT-VARIABLES.md)
