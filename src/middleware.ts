/**
 * Next.js Middleware — route protection.
 * Protects /dashboard, /results/*, /admin routes.
 * Uses Supabase auth to verify the session.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PATHS = ['/dashboard', '/results', '/admin'];
const ADMIN_PATHS = ['/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Defense in depth: never intercept API routes even if matcher mis-fires.
  // API routes handle their own auth via requireAuth().
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) {
    return NextResponse.next();
  }

  // Only protect specific paths
  const isProtected = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + '/')
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, { ...options, path: '/', sameSite: 'lax' });
          });
        },
      },
    }
  );

  // Validate the JWT with Supabase. getUser() also handles token refresh
  // internally — if the access token is expired but the refresh token is valid,
  // it refreshes and calls setAll() to persist the new cookies.
  //
  // IMPORTANT: Do NOT fall back to getSession() here. getSession() reads from
  // the cookie without server validation, so it would let users with expired
  // tokens through to protected pages. Then API calls (which use getUser())
  // would reject them with 401, creating a confusing redirect-to-login loop.
  const { data, error } = await supabase.auth.getUser();
  const user = error ? null : data.user;

  if (!user) {
    console.warn(`[middleware] No user session on protected route ${pathname} — redirecting to login`);
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Admin route check
  const isAdminRoute = ADMIN_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + '/')
  );

  if (isAdminRoute) {
    const role =
      user.user_metadata?.role || user.app_metadata?.role;
    if (role !== 'admin') {
      // Redirect non-admins to dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/results/:path*',
    '/admin/:path*',
  ],
};
