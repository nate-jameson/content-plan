import { NextRequest, NextResponse } from 'next/server';
import { checkPracticeWebsite } from '@/lib/website-monitor';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const changes = await checkPracticeWebsite(id);

    return NextResponse.json({
      success: true,
      changesFound: changes.length,
      changes,
    });
  } catch (error: any) {
    console.error('[CheckWebsite API] Error:', error);
    const message = error?.message || 'Internal server error';
    const status = message.includes('not found') ? 404
      : message.includes('No website') ? 400
      : message.includes('Could not reach') ? 502
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
