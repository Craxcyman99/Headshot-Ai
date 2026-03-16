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
import { createServerClient } from '@supabase/ssr';
import { config } from './config';

export interface AuthenticatedUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

/**
 * Require authentication for an API route.
 * Returns the authenticated user or an error response.
 */
export async function requireAuth(
  req: NextRequest
): Promise<{ user: AuthenticatedUser; error?: never } | { user?: never; error: NextResponse }> {
  try {
    const supabase = createServerClient(
      config.supabase.url,
      config.supabase.anonKey,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll().map(c => ({ name: c.name, value: c.value }));
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();

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
): Promise<{ user: AuthenticatedUser; error?: never } | { user?: never; error: NextResponse }> {
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
