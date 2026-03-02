import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const VALID_STATUSES = [
  'DETECTED', 'QUEUED', 'SCANNING', 'COMPLETED',
  'REVIEWED', 'APPROVED', 'FLAGGED', 'ERROR',
] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { status } = await request.json();

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  await prisma.article.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json({ success: true, status });
}
