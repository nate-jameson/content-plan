import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check database connection
  let dbConnected = false;
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    dbConnected = true;
  } catch {}

  const googleDriveConfigured = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );

  const copyleaksConfigured = !!(
    process.env.COPYLEAKS_EMAIL &&
    process.env.COPYLEAKS_API_KEY
  );

  const sesConfigured = !!(
    process.env.SES_ACCESS_KEY_ID &&
    process.env.SES_SECRET_ACCESS_KEY
  );

  return NextResponse.json({
    database: dbConnected,
    copyleaks: copyleaksConfigured,
    googleDrive: googleDriveConfigured,
    ses: sesConfigured,
    missing: {
      googleDrive: !googleDriveConfigured
        ? [
            !process.env.GOOGLE_CLIENT_ID && 'GOOGLE_CLIENT_ID',
            !process.env.GOOGLE_CLIENT_SECRET && 'GOOGLE_CLIENT_SECRET',
            !process.env.GOOGLE_REFRESH_TOKEN && 'GOOGLE_REFRESH_TOKEN',
          ].filter(Boolean)
        : [],
      copyleaks: !copyleaksConfigured
        ? [
            !process.env.COPYLEAKS_EMAIL && 'COPYLEAKS_EMAIL',
            !process.env.COPYLEAKS_API_KEY && 'COPYLEAKS_API_KEY',
          ].filter(Boolean)
        : [],
    },
  });
}
