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
      return NextResponse.json({ error: 'Forbidden: invalid origin' }, { status: 403 });
    }

    const { access_token, refresh_token } = await req.json();

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: 'Missing tokens' },
        { status: 400 }
      );
    }

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
              response.cookies.set({ name, value, ...options });
            });
          },
        },
      }
    );

    await supabase.auth.setSession({ access_token, refresh_token });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Failed to set session' },
      { status: 500 }
    );
  }
}
