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

  // Try getUser() first (validates JWT with Supabase), fall back to getSession() 
  // if Supabase API is unreachable (avoids redirect loop when Supabase is down)
  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error) {
      user = data.user;
    } else {
      // getUser() failed — try getSession() as fallback (reads from cookie only, no network)
      console.warn(`[middleware] getUser() failed: ${error.message} — falling back to getSession()`);
      const { data: sessionData } = await supabase.auth.getSession();
      user = sessionData.session?.user ?? null;
    }
  } catch (err: any) {
    console.error(`[middleware] Auth check threw: ${err.message} — falling back to getSession()`);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      user = sessionData.session?.user ?? null;
    } catch {
      // Complete auth failure — let the user through to avoid infinite redirect
      console.error('[middleware] Complete auth failure, allowing request through');
      return response;
    }
  }

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
