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
          driveAccount = emailSetting?.value 