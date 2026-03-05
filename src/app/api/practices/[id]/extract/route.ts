import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { listDocsInFolder, getDocContent } from '@/lib/google-drive';
import { callGemini, parseGeminiJson } from '@/lib/gemini';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const practice = await prisma.practice.findUnique({ where: { id } });
    if (!practice) {
      return NextResponse.json({ error: 'Practice not found' }, { status: 404 });
    }

    if (!practice.sourceFolderId) {
      return NextResponse.json(
        { error: 'No source folder configured for this practice. Set a Google Drive Project Folder first.' },
        { status: 400 }
      );
    }

    // List all docs in the source folder
    const docs = await listDocsInFolder(practice.sourceFolderId);
    if (!docs || docs.length === 0) {
      return NextResponse.json(
        { error: 'No documents found in the source folder.' },
        { status: 400 }
      );
    }

    // Download content from each doc (limit to first 10 to stay within token limits)
    const docsToProcess = docs.slice(0, 10);
    const docContents: string[] = [];

    for (const doc of docsToProcess) {
      try {
        const content = await getDocContent(doc.id);
        if (content && content.trim().length > 0) {
          docContents.push(`=== Document: ${doc.name} ===\n${content}`);
        }
      } catch (err) {
        console.warn(`[Extract] Failed to read doc ${doc.name}:`, err);
      }
    }

    if (docContents.length === 0) {
      return NextResponse.json(
        { error: 'Could not read any documents from the source folder.' },
        { status: 400 }
      );
    }

    const concatenatedDocs = docContents.join('\n\n');

    // Send to Gemini for extraction
    const prompt = `You are a dental practice brand guide extraction assistant. Analyze the following project documents for a dental practice and extract structured brand guide information.

DOCUMENTS:
${concatenatedDocs}

Extract the following information and return as JSON:

{
  "name": "Full practice name",
  "titlePrefix": "The prefix used at the start of blog article titles for this practice",
  "website": "Practice website URL",
  "brandVoiceNotes": "Description of the brand voice, tone, and writing style guidelines. Include target audience, key messaging themes, and any tone direction.",
  "doctors": [
    {
      "fullName": "Full name with credentials (e.g., Dr. Jane Smith, DDS)",
      "preferredFormat": "How the name should appear in content (e.g., Dr. Smith)",
      "role": "Their role (e.g., Lead Dentist, Hygienist, Office Manager)"
    }
  ],
  "services": [
    {
      "serviceName": "Service name",
      "isOffered": true
    }
  ],
  "bannedPhrases": [
    {
      "phrase": "Word or phrase to avoid",
      "suggestedAlt": "What to use instead",
      "reason": "Why it's banned",
      "severity": "error or warning"
    }
  ],
  "styleRules": [
    {
      "rule": "Specific writing rule or guideline",
      "category": "capitalization | terminology | tone | formatting | other"
    }
  ]
}

IMPORTANT:
- For services, include both offered AND not-offered services. If a document says they DON'T do something (e.g., "we don't offer CEREC"), include it with isOffered: false.
- For doctors, extract the preferred name format from how they're referenced in the content.
- For banned phrases, look for terminology warnings, words to avoid, or phrasing guidelines.
- For style rules, look for capitalization rules, preferred terms, formatting guidelines.
- For brand voice, synthesize from tone descriptions, audience info, and writing direction across all documents.
- Return ONLY valid JSON, no markdown formatting.`;

    const raw = await callGemini(prompt);

    let extracted;
    try {
      extracted = parseGeminiJson(raw);
    } catch {
      console.error('[Extract] Failed to parse Gemini JSON:', raw.slice(0, 500));
      return NextResponse.json(
        { error: 'Failed to parse extraction results. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      extracted,
      docsProcessed: docContents.length,
      totalDocs: docs.length,
    });
  } catch (error: any) {
    console.error('[Extract API] Error:', error);
    const message = error?.message || 'Internal server error';
    const status = message.includes('GEMINI_API_KEY') ? 500 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
