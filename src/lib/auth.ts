/**
 * Server-side authentication helper for API routes.
 * Uses @supabase/ssr to properly read chunked auth cookies.
 *
 * NOTE: We read cookies from the NextRequest object (req.cookies) rather than
 * next/headers cookies(). The latter can throw "The string did not match the
 * expected pattern" when parsing Supabase JWT cookie values that contain
 * base64 special characters.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { config } from './config';

export interface AuthenticatedUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

export interface CookieUpdate {
  name: string;
  value: string;
  options: CookieOptions;
}

type AuthSuccess = {
  user: AuthenticatedUser;
  cookieUpdates: CookieUpdate[];
  error?: never;
};

type AuthFailure = {
  user?: never;
  cookieUpdates?: never;
  error: NextResponse;
};

/**
 * Apply cookie updates from requireAuth() to a response.
 * This propagates session refresh cookies so the browser persists new tokens.
 */
export function applyAuthCookies(response: NextResponse, cookieUpdates: CookieUpdate[]): NextResponse {
  for (const { name, value, options } of cookieUpdates) {
    response.cookies.set(name, value, { ...options, path: '/', sameSite: 'lax' as const });
  }
  return response;
}

/**
 * Require authentication for an API route.
 * Returns the authenticated user and any cookie updates (from token refresh).
 * Route handlers MUST call applyAuthCookies() on their response to persist
 * refreshed tokens — otherwise the browser keeps the old (invalidated) refresh
 * token and every subsequent request fails.
 */
export async function requireAuth(
  req: NextRequest
): Promise<AuthSuccess | AuthFailure> {
  try {
    const cookieUpdates: CookieUpdate[] = [];

    const supabase = createServerClient(
      config.supabase.url,
      config.supabase.anonKey,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll().map(c => ({ name: c.name, value: c.value }));
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            for (const c of cookiesToSet) {
              cookieUpdates.push(c);
            }
          },
        },
      }
    );

    // Check Authorization: Bearer header first, then fall back to cookies
    const authHeader = req.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const { data: { user }, error } = bearerToken
      ? await supabase.auth.getUser(bearerToken)
      : await supabase.auth.getUser();

    if (error || !user) {
      return {
        error: NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        ),
      };
    }

    // Check admin role from user metadata
    const isAdmin = user.user_metadata?.role === 'admin' ||
                    user.app_metadata?.role === 'admin';

    return {
      user: {
        id: user.id,
        email: user.email ?? '',
        isAdmin,
      },
      cookieUpdates,
    };
  } catch (err) {
    console.error('Auth error:', err);
    return {
      error: NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      ),
    };
  }
}

/**
 * Require admin role for an API route.
 */
export async function requireAdmin(
  req: NextRequest
): Promise<AuthSuccess | AuthFailure> {
  const authResult = await requireAuth(req);

  if ('error' in authResult) {
    return authResult;
  }

  if (!authResult.user.isAdmin) {
    return {
      error: NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      ),
    };
  }

  return authResult;
}
