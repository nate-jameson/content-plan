import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { level } = await request.json();

  // Validate level
  if (![1, 2, 3].includes(level)) {
    return NextResponse.json(
      { error: 'Invalid level. Must be 1, 2, or 3.' },
      { status: 400 }
    );
  }

  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  // Update detection level and set status back to DETECTED for resubmission
  await prisma.article.update({
    where: { id },
    data: {
      aiDetectionLevel: level,
      status: 'DETECTED',
    },
  });

  return NextResponse.json({ success: true, level });
}
