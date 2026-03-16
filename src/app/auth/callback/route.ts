/**
 * Auth callback route for Supabase magic link / OAuth.
 * Exchanges the auth code for a session, sets cookies, redirects to dashboard.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  let next = searchParams.get('next') || '/dashboard';

  // Prevent open redirect: only allow relative paths
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('://')) {
    next = '/dashboard';
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent('Missing auth code')}`, req.url)
    );
  }

  let response = NextResponse.redirect(new URL(next, req.url));

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
            response.cookies.set({ name, value, ...options, path: '/', sameSite: 'lax' as const });
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Auth callback error:', error);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error.message)}`, req.url)
    );
  }

  return response;
}
