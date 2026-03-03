import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow auth API routes, webhooks, and public API endpoints
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/copyleaks-webhook') ||
    pathname.startsWith('/api/scan/drive-poll')
  ) {
    return NextResponse.next();
  }

  // Check for NextAuth session cookie (works on Edge without importing Node.js modules)
  const sessionToken =
    request.cookies.get('__Secure-authjs.session-token') ||
    request.cookies.get('authjs.session-token') ||
    request.cookies.get('next-auth.session-token') ||
    request.cookies.get('__Secure-next-auth.session-token');

  const isLoggedIn = !!sessionToken;
  const isLoginPage = pathname.startsWith('/login');

  // Redirect to login if not authenticated
  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect to dashboard if already logged in and on login page
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
