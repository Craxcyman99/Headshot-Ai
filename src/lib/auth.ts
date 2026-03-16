/**
 * Server-side authentication helper for API routes.
 * Validates the user's session from the Authorization header or cookies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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
    // Extract JWT from Authorization header or cookie
    const authHeader = req.headers.get('authorization');
    let token: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else {
      // Try cookie-based auth
      const cookieHeader = req.headers.get('cookie');
      if (cookieHeader) {
        // Look for supabase auth token in cookies
        const match = cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/);
        if (match) {
          try {
            const parsed = JSON.parse(decodeURIComponent(match[1]));
            token = parsed?.access_token;
          } catch {}
        }
      }
    }

    if (!token) {
      return {
        error: NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        ),
      };
    }

    const supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return {
        error: NextResponse.json(
          { error: 'Invalid or expired token' },
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
