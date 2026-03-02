// ============================================================
// Copyleaks API Client
// ============================================================
// Handles authentication, scan submission, and result parsing.
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
 * Includes: plagiarism, AI detection, and writing feedback.
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
    `${COPYLEAKS_API_BASE}/v2/writer/create/${params.scanId}`,
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
          sandbox: params.sandbox ?? (process.env.NODE_ENV !== 'production'),
          expiration: 480, // Results available for 480 hours
          developerPayload: params.articleId,
          pdf: {
            create: true, // Generate downloadable PDF report
          },
          aiGeneratedText: {
            detect: true, // Enable AI detection
          },
          writingFeedback: {
            score: true, // Enable grammar/writing quality
          },
          scanning: {
            internet: true,       // Check against internet
            copyleaksDb: true,    // Check against Copyleaks database
            repositories: true,   // Check against our internal repository
          },
          indexing: {
            repositories: ['default'], // Index in our repo for cross-writer checks
          },
          sensitivityLevel: 3, // 1-5, higher = stricter matching
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
 * Download the PDF report for a completed scan.
 */
export async function downloadPdfReport(scanId: string): Promise<Buffer> {
  const token = await getAccessToken();

  const response = await fetch(
    `${COPYLEAKS_API_BASE}/v1/downloads/${scanId}/report.pdf`,
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
 * Export scan results in a structured format.
 * Use this for detailed drill-down data.
 */
export async function exportResults(scanId: string): Promise<any> {
  const token = await getAccessToken();

  // Request full export with all result details
  const response = await fetch(
    `${COPYLEAKS_API_BASE}/v1/downloads/${scanId}/export`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        results: ['internet', 'database', 'batch'],
        aiDetection: true,
        writingFeedback: true,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Export failed: ${response.status}`);
  }

  return response.json();
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
