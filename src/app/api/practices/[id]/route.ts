import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const practice = await prisma.practice.findUnique({
      where: { id },
      include: {
        doctors: true,
        services: true,
        bannedPhrases: true,
        styleRules: true,
      },
    });

    if (!practice) {
      return NextResponse.json({ error: 'Practice not found' }, { status: 404 });
    }

    return NextResponse.json(practice);
  } catch (error) {
    console.error('[Practices API] GET by id error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, titlePrefix, website, brandVoiceNotes, sourceFolderId, doctors, services, bannedPhrases, styleRules } = body;

    if (!name || !titlePrefix) {
      return NextResponse.json(
        { error: 'Name and title prefix are required' },
        { status: 400 }
      );
    }

    const practice = await prisma.$transaction(async (tx) => {
      // Delete existing children
      await tx.practiceDoctor.deleteMany({ where: { practiceId: id } });
      await tx.practiceService.deleteMany({ where: { practiceId: id } });
      await tx.bannedPhrase.deleteMany({ where: { practiceId: id } });
      await tx.styleRule.deleteMany({ where: { practiceId: id } });

      // Update practice and recreate children
      return tx.practice.update({
        where: { id },
        data: {
          name,
          titlePrefix,
          website: website || null,
          brandVoiceNotes: brandVoiceNotes || null,
          sourceFolderId: sourceFolderId || null,
          doctors: {
            create: (doctors || []).map((d: any) => ({
              fullName: d.fullName,
              preferredFormat: d.preferredFormat,
              role: d.role || null,
            })),
          },
          services: {
            create: (services || []).map((s: any) => ({
              serviceName: s.serviceName,
              isOffered: s.isOffered !== false,
            })),
          },
          bannedPhrases: {
            create: (bannedPhrases || []).map((bp: any) => ({
              phrase: bp.phrase,
              suggestedAlt: bp.suggestedAlt || null,
              reason: bp.reason || null,
              severity: bp.severity || 'warning',
            })),
          },
          styleRules: {
            create: (styleRules || []).map((sr: any) => ({
              rule: sr.rule,
              category: sr.category || 'general',
            })),
          },
        },
        include: {
          doctors: true,
          services: true,
          bannedPhrases: true,
          styleRules: true,
        },
      });
    });

    return NextResponse.json({ success: true, practice });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A practice with this name or title prefix already exists' },
        { status: 409 }
      );
    }
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Practice not found' }, { status: 404 });
    }
    console.error('[Practices API] PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.practice.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Practice not found' }, { status: 404 });
    }
    console.error('[Practices API] DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
