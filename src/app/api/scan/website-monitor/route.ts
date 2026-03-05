import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkPracticeWebsite } from '@/lib/website-monitor';

async function runMonitor() {
  const practices = await prisma.practice.findMany({
    where: {
      isActive: true,
      website: { not: null },
    },
    select: { id: true, name: true, website: true },
  });

  console.log(`[WebsiteMonitor] Checking ${practices.length} practices...`);

  const results: Array<{ practiceId: string; name: string; changesFound: number; error?: string }> = [];

  for (const p of practices) {
    try {
      const changes = await checkPracticeWebsite(p.id);
      results.push({ practiceId: p.id, name: p.name, changesFound: changes.length });
      console.log(`[WebsiteMonitor] ${p.name}: ${changes.length} changes detected`);
    } catch (error: any) {
      console.error(`[WebsiteMonitor] ${p.name} failed:`, error?.message);
      results.push({ practiceId: p.id, name: p.name, changesFound: 0, error: error?.message });
    }
  }

  return results;
}

export async function GET() {
  try {
    const results = await runMonitor();
    const totalChanges = results.reduce((sum, r) => sum + r.changesFound, 0);
    return NextResponse.json({
      success: true,
      practicesChecked: results.length,
      totalChangesFound: totalChanges,
      results,
    });
  } catch (error: any) {
    console.error('[WebsiteMonitor] Cron error:', error);
    return NextResponse.json({ error: error?.message || 'Monitor failed' }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
