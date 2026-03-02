import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const writer = await prisma.writer.findUnique({ where: { id } });
  if (!writer) {
    return NextResponse.json({ error: 'Writer not found' }, { status: 404 });
  }

  await prisma.writer.update({
    where: { id },
    data: { isActive: !writer.isActive },
  });

  return NextResponse.json({ success: true, isActive: !writer.isActive });
}
