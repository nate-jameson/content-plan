// ============================================================
// Copyleaks API Client
// ============================================================
// Handles authentication, scan submission, export triggers, and result parsing.
// Docs: https://docs.copyleaks.com/reference/actions/overview/

const COPYLEAKS_API_BASE = 'https://api.copyleaks.com';
const COPYLEAKS_ID_API = 'https://id.copyleaks.com';

interface CopyleaksAuthToken {
  access_token: string;
  expires_in: number;
  issued_at: number;
}

let cachedToken: CopyleaksAuthToken | null = null;

/**
 * Authenticate with Copyleaks and get an access token.
 * Tokens are cached until expiry.
 */
export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5min buffer)
  if (cachedToken) {
    const expiresAt = cachedToken.issued_at + (cachedToken.expires_in * 1000) - 300000;
    if (Date.now() < expiresAt) {
      return cachedToken.access_token;
    }
  }

  const response = await fetch(`${COPYLEAKS_ID_API}/v3/account/login/api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.COPYLEAKS_EMAIL,
      key: process.env.COPYLEAKS_API_KEY,
    }),
  });

  if (!response.ok) {
    throw new Error(`Copyleaks auth failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  cachedToken = {
    access_token: data.access_token,
    expires_in: data.expires_in || 3600,
    issued_at: Date.now(),
  };

  return cachedToken.access_token;
}

/**
 * Submit an article for a full authenticity scan.
 * Includes: plagiarism (internet only) and AI detection.
 * 
 * Results are delivered asynchronously via webhook.
 */
export async function submitScan(params: {
  scanId: string;         // Our internal article ID (used as Copyleaks scan ID)
  text: string;           // Article content
  articleId: string;      // Passed back in webhook as developerPayload
  webhookUrl: string;     // Where Copyleaks sends results
  sandbox?: boolean;      // Use sandbox mode for testing
}): Promise<void> {
  const token = await getAccessToken();

  const response = await fetch(
    `${COPYLEAKS_API_BASE}/v3/scans/submit/file/${params.scanId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        base64: Buffer.from(params.text).toString('base64'),
        filename: 'article.txt',
        properties: {
          webhooks: {
            status: `${params.webhookUrl}/{STATUS}`,
          },
          sandbox: params.sandbox ?? false,
          expiration: 480,
          developerPayload: params.articleId,
          pdf: {
            create: true,
          },
          aiGeneratedText: {
            detect: true,
          },
          // writingFeedback not available on current plan
          scanning: {
            internet: true,
            // Disable internal DB matching to prevent self-matching false positives.
            // Our articles were matching against our own previous submissions.
            copyleaksDb: false,
          },
          sensitivityLevel: 3,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Copyleaks scan submission failed: ${response.status} ${errorText}`);
  }
}

/**
 * Trigger an export to get AI detection results and PDF report.
 * Copyleaks pushes data to the specified endpoints asynchronously.
 * 
 * Call this AFTER the scan completed webhook is processed.
 */
export async function triggerExport(params: {
  copyleaksScanId: string;
  scanResultId: string;     // Our internal scan_result ID for routing
  resultIds?: string[];      // Result IDs from the completed webhook (for detailed source data)
}): Promise<void> {
  const token = await getAccessToken();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://content.jmsn.com';
  const exportId = `exp-${params.scanResultId.slice(-16)}-${Date.now().toString().slice(-6)}`;

  const body: any = {
    completionWebhook: `${baseUrl}/api/copyleaks-export/done/${params.copyleaksScanId}`,
    maxRetries: 5,
    developerPayload: params.scanResultId,
    aiDetection: {
      endpoint: `${baseUrl}/api/copyleaks-export/ai/${params.copyleaksScanId}`,
      verb: 'POST',
    },
    pdfReport: {
      endpoint: `${baseUrl}/api/copyleaks-export/pdf/${params.copyleaksScanId}`,
      verb: 'POST',
    },
  };

  // Include individual result downloads for detailed source data
  if (params.resultIds && params.resultIds.length > 0) {
    body.results = params.resultIds.slice(0, 50).map((id: string) => ({
      id,
      endpoint: `${baseUrl}/api/copyleaks-export/result/${params.copyleaksScanId}/${id}`,
      verb: 'POST',
    }));
  }

  console.log(`[Copyleaks Export] Triggering export ${exportId} for scan ${params.copyleaksScanId}`);

  const response = await fetch(
    `${COPYLEAKS_API_BASE}/v3/downloads/${params.copyleaksScanId}/export/${exportId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Copyleaks Export] Failed: ${response.status} ${errorText}`);
    // Non-fatal — plagiarism results are already stored
    throw new Error(`Export trigger failed: ${response.status} ${errorText}`);
  }

  console.log(`[Copyleaks Export] Export triggered successfully: ${exportId}`);
}

/**
 * Download the PDF report for a completed scan (on-demand proxy).
 * Used when user clicks "Download PDF" in the dashboard.
 */
export async function downloadPdfReport(scanId: string): Promise<Buffer> {
  const token = await getAccessToken();

  const response = await fetch(
    `${COPYLEAKS_API_BASE}/v3/downloads/${scanId}/report.pdf`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    throw new Error(`PDF download failed: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Get remaining Copyleaks credits.
 */
export async function getCredits(): Promise<number> {
  const token = await getAccessToken();

  const response = await fetch(
    `${COPYLEAKS_API_BASE}/v3/scans/credits`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  if (!response.ok) return -1;
  const data = await response.json();
  return data.amount ?? 0;
}
