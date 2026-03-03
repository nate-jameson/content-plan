import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, driveFolderId } = body;

    if (!name || !driveFolderId) {
      return NextResponse.json(
        { error: 'Name and Drive folder ID are required' },
        { status: 400 }
      );
    }

    const writer = await prisma.writer.create({
      data: {
        name,
        ...(email ? { email } : {}),
        driveFolderId,
      },
    });

    // Trigger an immediate drive poll for the new writer's folder
    try {
      const baseUrl = process.env.NEXTAUTH_URL || 'https://content.jmsn.com';
      fetch(`${baseUrl}/api/scan/drive-poll`, { method: 'GET' }).catch(() => {});
    } catch {}

    return NextResponse.json({ success: true, writer });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A writer with this email or Drive folder ID already exists' },
        { status: 409 }
      );
    }
    console.error('[Writers API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  const writers = await prisma.writer.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { articles: true } } },
  });
  return NextResponse.json(writers);
}
