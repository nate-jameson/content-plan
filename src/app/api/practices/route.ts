import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const practices = await prisma.practice.findMany({
      orderBy: { name: 'asc' },
      include: {
        doctors: true,
        services: true,
        bannedPhrases: true,
        styleRules: true,
      },
    });
    return NextResponse.json(practices);
  } catch (error) {
    console.error('[Practices API] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, titlePrefix, website, brandVoiceNotes, doctors, services, bannedPhrases, styleRules } = body;

    if (!name || !titlePrefix) {
      return NextResponse.json(
        { error: 'Name and title prefix are required' },
        { status: 400 }
      );
    }

    const practice = await prisma.practice.create({
      data: {
        name,
        titlePrefix,
        website: website || null,
        brandVoiceNotes: brandVoiceNotes || null,
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

    return NextResponse.json({ success: true, practice }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A practice with this name or title prefix already exists' },
        { status: 409 }
      );
    }
    console.error('[Practices API] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
