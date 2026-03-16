/**
 * CSRF Protection for API routes.
 * Uses Origin/Referer header checking for state-changing operations.
 * Next.js App Router API routes are already safe from form-based CSRF
 * when using JSON content types, but we add Origin validation for defense in depth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { config } from './config';

/**
 * Validate the Origin/Referer header matches our app URL.
 * Call this in every POST/PUT/DELETE/PATCH handler.
 */
export function validateOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const host = req.headers.get('host');

  const appUrl = config.app.url;
  let allowedOrigins = [appUrl];

  // Also allow same-origin requests via host header
  if (host) {
    const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
    if (isLocalhost || process.env.NODE_ENV !== 'production') {
      allowedOrigins.push(`http://${host}`);
    }
    allowedOrigins.push(`https://${host}`);
  }

  // Allow localhost in development
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push(
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000'
    );
  }

  // Check origin first (most reliable) — exact match only
  if (origin) {
    return allowedOrigins.some((allowed) => origin === allowed);
  }

  // Fall back to referer check — exact origin match only
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      return allowedOrigins.some((allowed) => refererOrigin === allowed);
    } catch {
      return false;
    }
  }

  // If neither origin nor referer is present, reject in production
  // (in dev, allow for API testing tools)
  return process.env.NODE_ENV !== 'production';
}

/**
 * Middleware wrapper that enforces CSRF protection.
 */
export function csrfProtected<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (req: NextRequest, ...args: any[]) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      if (!validateOrigin(req)) {
        return NextResponse.json(
          { error: 'Forbidden: invalid origin' },
          { status: 403 }
        );
      }
    }
    return handler(req, ...args);
  }) as T;
}
