import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export async function GET() {
  const prisma = new PrismaClient();

  try {
    // --- Database ---
    let dbStatus = 'not_configured';
    let dbDetail = '';
    const dbMissing: string[] = [];
    if (!process.env.DATABASE_URL) {
      dbMissing.push('DATABASE_URL');
    } else {
      try {
        const result = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM allowed_users`;
        dbStatus = 'connected';
        dbDetail = `${result[0].count} allowed users`;
      } catch (err: unknown) {
        dbStatus = 'error';
        dbDetail = err instanceof Error ? err.message : 'Connection failed';
      }
    }

    // --- Google Drive ---
    let driveStatus = 'not_configured';
    let driveDetail = '';
    let driveAccount = '';
    const driveMissing: string[] = [];

    if (!process.env.GOOGLE_CLIENT_ID) driveMissing.push('GOOGLE_CLIENT_ID');
    if (!process.env.GOOGLE_CLIENT_SECRET) driveMissing.push('GOOGLE_CLIENT_SECRET');

    // Check refresh token: env var OR database
    let hasRefreshToken = !!process.env.GOOGLE_REFRESH_TOKEN;
    if (!hasRefreshToken) {
      try {
        const setting = await prisma.appSetting.findUnique({ where: { key: 'google_refresh_token' } });
        hasRefreshToken = !!setting?.value;
        if (hasRefreshToken) {
          // Get connected account email
          const emailSetting = await prisma.appSetting.findUnique({ where: { key: 'google_account_email' } });
          driveAccount = emailSetting?.value || '';
        }
      } catch {
        // Table may not exist yet - that's OK
      }
    }

    if (driveMissing.length > 0) {
      driveStatus = 'not_configured';
      driveDetail = `Missing: ${driveMissing.join(', ')}`;
    } else if (!hasRefreshToken) {
      driveStatus = 'needs_auth';
      driveDetail = 'Click "Connect Google Account" to authorize';
    } else {
      driveStatus = 'connected';
      driveDetail = driveAccount ? `Connected as ${driveAccount}` : 'Connected';
    }

    // --- Copyleaks ---
    let copyleaksStatus = 'not_configured';
    let copyleaksDetail = '';
    const copyleaksMissing: string[] = [];
    if (!process.env.COPYLEAKS_API_KEY) copyleaksMissing.push('COPYLEAKS_API_KEY');
    if (!process.env.COPYLEAKS_EMAIL) copyleaksMissing.push('COPYLEAKS_EMAIL');

    if (copyleaksMissing.length > 0) {
      copyleaksDetail = `Missing: ${copyleaksMissing.join(', ')}`;
    } else {
      copyleaksStatus = 'connected';
      copyleaksDetail = 'API credentials configured';
    }

    return NextResponse.json({
      database: { status: dbStatus, detail: dbDetail, missing: dbMissing },
      googleDrive: { status: driveStatus, detail: driveDetail, missing: driveMissing, account: driveAccount },
      copyleaks: { status: copyleaksStatus, detail: copyleaksDetail, missing: copyleaksMissing },
    });
  } catch (err) {
    console.error('Status check error:', err);
    return NextResponse.json({ error: 'Status check failed' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
