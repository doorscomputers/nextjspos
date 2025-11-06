// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Environment configuration
  environment: process.env.NODE_ENV,

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Automatically capture all unhandled exceptions
  integrations: [
    Sentry.prismaIntegration({
      // Optional: Log database queries (useful for debugging)
      // Only enable in development or staging
      logLevel: process.env.NODE_ENV === 'production' ? 'error' : 'info',
    }),
  ],

  // Filter out sensitive data
  beforeSend(event) {
    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['Authorization'];
      delete event.request.headers['Cookie'];
      delete event.request.headers['Set-Cookie'];
    }

    // Remove sensitive query params
    if (event.request?.query_string) {
      const sensitiveParams = ['token', 'password', 'secret', 'api_key'];
      let queryString = event.request.query_string;

      sensitiveParams.forEach(param => {
        const regex = new RegExp(`${param}=[^&]*`, 'gi');
        queryString = queryString.replace(regex, `${param}=[REDACTED]`);
      });

      event.request.query_string = queryString;
    }

    // Remove sensitive data from context
    if (event.contexts?.user) {
      delete event.contexts.user.email;
    }

    return event;
  },

  // Ignore specific errors
  ignoreErrors: [
    // Prisma known errors that are handled gracefully
    'PrismaClientKnownRequestError',
    // Next.js development hot reload errors
    'NEXT_NOT_FOUND',
    'NEXT_REDIRECT',
    // Network timeouts (often not actionable)
    'ETIMEDOUT',
    'ECONNRESET',
  ],
});
