import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const users = await prisma.allowedUser.findMany({
    orderBy: { addedAt: 'asc' },
  });
  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { email, name, role } = body;

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  try {
    const user = await prisma.allowedUser.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name || null,
        role: role || 'editor',
      },
    });
    return NextResponse.json({ success: true, user });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'This email is already in the allowed list' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  // Prevent removing yourself
  const user = await prisma.allowedUser.findUnique({ where: { id } });
  if (user?.email === session.user?.email) {
    return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 });
  }

  await prisma.allowedUser.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
