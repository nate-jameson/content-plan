import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?drive_error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/settings?drive_error=no_code', request.url)
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, '') || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const redirectUri = `${baseUrl}/api/auth/google-drive/callback`;

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokens);
      return NextResponse.redirect(
        new URL(`/settings?drive_error=${encodeURIComponent(tokens.error_description || tokens.error || 'token_exchange_failed')}`, request.url)
      );
    }

    if (!tokens.refresh_token) {
      console.error('No refresh token in response. User may need to revoke access and retry.');
      return NextResponse.redirect(
        new URL('/settings?drive_error=no_refresh_token', request.url)
      );
    }

    // Store the refresh token in the database
    await prisma.$executeRaw`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('google_refresh_token', ${tokens.refresh_token}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${tokens.refresh_token}, updated_at = NOW()
    `;

    // Get connected Google account info
    let accountEmail = 'Unknown';
    try {
      const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const user = await userInfo.json();
      accountEmail = user.email || 'Unknown';

      await prisma.$executeRaw`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES ('google_account_email', ${accountEmail}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${accountEmail}, updated_at = NOW()
      `;
    } catch {
      // Non-critical - continue without account info
    }

    return NextResponse.redirect(
      new URL('/settings?drive_connected=true', request.url)
    );
  } catch (err) {
    console.error('Google Drive OAuth error:', err);
    return NextResponse.redirect(
      new URL(`/settings?drive_error=server_error`, request.url)
    );
  } finally {
    await prisma.$disconnect();
  }
}
