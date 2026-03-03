import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({
    database: !!process.env.DATABASE_URL,
    copyleaks: !!process.env.COPYLEAKS_EMAIL && !!process.env.COPYLEAKS_API_KEY,
    googleDrive: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && !!process.env.GOOGLE_PRIVATE_KEY,
    ses: !!process.env.SES_ACCESS_KEY_ID && !!process.env.SES_SECRET_ACCESS_KEY,
  });
}
