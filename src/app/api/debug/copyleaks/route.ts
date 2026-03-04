// Debug endpoint to test Copyleaks API directly
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const email = process.env.COPYLEAKS_EMAIL;
    const apiKey = process.env.COPYLEAKS_API_KEY;

    if (!email || !apiKey) {
      return NextResponse.json({ error: 'Missing COPYLEAKS_EMAIL or COPYLEAKS_API_KEY' });
    }

    // Step 1: Authenticate
    const authResp = await fetch('https://id.copyleaks.com/v3/account/login/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, key: apiKey }),
    });

    const authStatus = authResp.status;
    const authBody = await authResp.text();

    if (!authResp.ok) {
      return NextResponse.json({ step: 'auth', status: authStatus, body: authBody });
    }

    const token = JSON.parse(authBody).access_token;

    // Step 2: Submit a minimal test scan
    const testContent = 'This is a test article about dental care and oral hygiene practices.';
    const base64Content = Buffer.from(testContent).toString('base64');
    const scanId = 'test-debug-' + Date.now().toString(36);

    const submitBody = {
      base64: base64Content,
      filename: 'test.txt',
      properties: {
        webhooks: {
          status: 'https://content.jmsn.com/api/copyleaks-webhook/{STATUS}',
        },
        sandbox: true,
      },
    };

    const submitBodyStr = JSON.stringify(submitBody);

    const submitResp = await fetch(
      `https://api.copyleaks.com/v3/scans/submit/file/${scanId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: submitBodyStr,
      }
    );

    const submitStatus = submitResp.status;
    const submitRespBody = await submitResp.text();

    return NextResponse.json({
      auth: { status: authStatus, tokenPrefix: token.substring(0, 20) },
      submit: {
        status: submitStatus,
        response: submitRespBody,
        scanId,
        bodyLength: submitBodyStr.length,
        bodyPreview: submitBodyStr.substring(0, 200),
        base64Length: base64Content.length,
        url: `https://api.copyleaks.com/v3/scans/submit/file/${scanId}`,
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
