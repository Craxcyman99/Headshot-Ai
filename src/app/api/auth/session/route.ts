/**
 * Server-side session setter.
 * After signup/signin on the client, POST tokens here so the server
 * sets proper Set-Cookie headers that persist across page navigation.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { validateOrigin } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  try {
    // CSRF protection
    if (!validateOrigin(req)) {
      console.error('[session] CSRF rejected — origin:', req.headers.get('origin'), 'host:', req.headers.get('host'));
      return NextResponse.json({ error: 'Forbidden: invalid origin' }, { status: 403 });
    }

    const { access_token, refresh_token } = await req.json();

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: 'Missing tokens' },
        { status: 400 }
      );
    }

    const isSecure = process.env.NODE_ENV === 'production' || req.headers.get('x-forwarded-proto') === 'https';

    const response = NextResponse.json({ success: true });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll().map(c => ({ name: c.name, value: c.value }));
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set({
                name,
                value,
                ...options,
                path: '/',
                sameSite: 'lax' as const,
                secure: isSecure,
                // No explicit domain — browser defaults to current host
              });
            });
          },
        },
      }
    );

    const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });

    if (sessionError) {
      console.error('[session] Failed to set Supabase session:', sessionError.message);
      return NextResponse.json(
        { error: 'Failed to establish session', detail: sessionError.message },
        { status: 401 }
      );
    }

    // Log Set-Cookie headers for debugging auth flow
    const setCookies = response.headers.getSetCookie();
    console.log(`[session] Set ${setCookies.length} cookie(s):`, setCookies.map(c => c.split('=')[0]));

    if (setCookies.length === 0) {
      console.error('[session] setSession succeeded but no cookies were set');
      return NextResponse.json(
        { error: 'Session created but cookies failed to set' },
        { status: 500 }
      );
    }

    return response;
  } catch (err) {
    console.error('[session] Failed to set session:', err);
    return NextResponse.json(
      { error: 'Failed to set session' },
      { status: 500 }
    );
  }
}
