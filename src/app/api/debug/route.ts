import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    env: {
      AUTH_SECRET: !!process.env.AUTH_SECRET,
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
      AUTH_URL: !!process.env.AUTH_URL,
      DATABASE_URL: !!process.env.DATABASE_URL,
      SES_ACCESS_KEY_ID: !!process.env.SES_ACCESS_KEY_ID,
      SES_SECRET_ACCESS_KEY: !!process.env.SES_SECRET_ACCESS_KEY,
      SES_REGION: !!process.env.SES_REGION,
      EMAIL_FROM: !!process.env.EMAIL_FROM,
    },
    nextauth_version: '5.0.0-beta.30',
  });
}
