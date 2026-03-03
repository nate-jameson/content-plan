import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

export async function GET() {
  const debug: Record<string, any> = {};

  debug.hasClientId = !!process.env.GOOGLE_CLIENT_ID;
  debug.hasClientSecret = !!process.env.GOOGLE_CLIENT_SECRET;
  debug.hasEnvRefreshToken = !!process.env.GOOGLE_REFRESH_TOKEN;

  try {
    const prisma = new PrismaClient();
    const setting = await prisma.appSetting.findUnique({ where: { key: 'google_refresh_token' } });
    const emailSetting = await prisma.appSetting.findUnique({ where: { key: 'google_account_email' } });
    debug.dbRefreshTokenExists = !!setting?.value;
    debug.dbRefreshTokenLength = setting?.value?.length ?? 0;
    debug.connectedEmail = emailSetting?.value ?? null;

    const writers = await prisma.writer.findMany({ select: { id: true, name: true, driveFolderId: true, isActive: true } });
    debug.writers = writers;
    await prisma.$disconnect();
  } catch (err) {
    debug.dbError = err instanceof Error ? err.message : String(err);
  }

  try {
    const prisma = new PrismaClient();
    const setting = await prisma.appSetting.findUnique({ where: { key: 'google_refresh_token' } });
    await prisma.$disconnect();

    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || setting?.value;
    if (!refreshToken) {
      debug.driveError = 'No refresh token found';
      return NextResponse.json(debug);
    }

    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    auth.setCredentials({ refresh_token: refreshToken });
    const drive = google.drive({ version: 'v3', auth });

    const aboutRes = await drive.about.get({ fields: 'user' });
    debug.driveUser = aboutRes.data.user;

    if (debug.writers?.[0]?.driveFolderId) {
      const folderId = debug.writers[0].driveFolderId;

      try {
        const folderRes = await drive.files.get({
          fileId: folderId,
          fields: 'id, name, mimeType',
          supportsAllDrives: true,
        });
        debug.folder = folderRes.data;
      } catch (err: any) {
        debug.folderError = err?.message || String(err);
      }

      const listRes = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType)',
        pageSize: 10,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      });
      debug.filesInFolder = listRes.data.files;
      debug.fileCount = listRes.data.files?.length ?? 0;

      const docsRes = await drive.files.list({
        q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.document' and trashed = false`,
        fields: 'files(id, name, mimeType)',
        pageSize: 10,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      });
      debug.googleDocsInFolder = docsRes.data.files;
      debug.googleDocCount = docsRes.data.files?.length ?? 0;
    }
  } catch (err: any) {
    debug.driveApiError = err?.message || String(err);
    debug.driveApiCode = err?.code;
  }

  return NextResponse.json(debug);
}
