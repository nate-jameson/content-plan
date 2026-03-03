import { NextResponse } from 'next/server';

export async function GET() {
  const env = {
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || false,
    AUTH_URL: process.env.AUTH_URL || false,
    VERCEL_URL: process.env.VERCEL_URL || false,
    DATABASE_URL: !!process.env.DATABASE_URL,
    SES_ACCESS_KEY_ID: !!process.env.SES_ACCESS_KEY_ID,
    SES_SECRET_ACCESS_KEY: !!process.env.SES_SECRET_ACCESS_KEY,
    SES_REGION: process.env.SES_REGION || false,
    EMAIL_FROM: process.env.EMAIL_FROM || false,
    COPYLEAKS_EMAIL: process.env.COPYLEAKS_EMAIL || false,
    COPYLEAKS_API_KEY: !!process.env.COPYLEAKS_API_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || false,
  };

  // Try importing auth to see if it throws
  let authError = null;
  try {
    const { auth } = await import('@/lib/auth');
    authError = 'none - auth imported OK';
  } catch (e: any) {
    authError = e.message || String(e);
  }

  // Try connecting to DB
  let dbError = null;
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const count = await prisma.allowedUser.count();
    await prisma.$disconnect();
    dbError = `none - ${count} allowed users found`;
  } catch (e: any) {
    dbError = e.message || String(e);
  }

  return NextResponse.json({
    env,
    authError,
    dbError,
    nextauth_version: require('next-auth/package.json').version,
  });
}
