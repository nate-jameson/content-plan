import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function extractDriveFolderId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return trimmed;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, driveFolderId } = body;

    if (!name || !driveFolderId) {
      return NextResponse.json(
        { error: 'Name and Drive folder ID are required' },
        { status: 400 }
      );
    }

    const writer = await prisma.writer.update({
      where: { id },
      data: {
        name,
        email: email || null,
        driveFolderId: extractDriveFolderId(driveFolderId),
      },
    });

    return NextResponse.json({ success: true, writer });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Writer not found' }, { status: 404 });
    }
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A writer with this email or Drive folder ID already exists' },
        { status: 409 }
      );
    }
    console.error('[Writers API] Update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.writer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Writer not found' }, { status: 404 });
    }
    console.error('[Writers API] Delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
