import { auth } from '@/lib/auth';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname.startsWith('/login');
  const isAuthApi = req.nextUrl.pathname.startsWith('/api/auth');
  const isWebhook = req.nextUrl.pathname.startsWith('/api/copyleaks-webhook');
  const isDrivePoll = req.nextUrl.pathname.startsWith('/api/scan/drive-poll');

  // Allow auth API routes, webhooks, and public API endpoints
  if (isAuthApi || isWebhook || isDrivePoll) return;

  // Redirect to login if not authenticated
  if (!isLoggedIn && !isLoginPage) {
    return Response.redirect(new URL('/login', req.nextUrl));
  }

  // Redirect to dashboard if already logged in and on login page
  if (isLoggedIn && isLoginPage) {
    return Response.redirect(new URL('/', req.nextUrl));
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
