// ============================================================
// Google Drive Integration
// ============================================================
// Handles folder monitoring, document fetching, and comment posting.
// Uses Google Drive API v3 with OAuth2 service account or user tokens.

import { google, drive_v3 } from 'googleapis';

let driveClient: drive_v3.Drive | null = null;

/**
 * Initialize the Google Drive client.
 * Uses OAuth2 credentials stored in environment variables.
 */
function getDriveClient(): drive_v3.Drive {
  if (driveClient) return driveClient;

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  modifiedTime: string;
  createdTime: string;
}

/**
 * List all Google Docs in a specific folder.
 * Filters to only Google Docs (not PDFs, images, etc.)
 */
export async function listDocsInFolder(folderId: string): Promise<DriveFile[]> {
  const drive = getDriveClient();
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.document' and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, webViewLink, modifiedTime, createdTime)',
      pageSize: 100,
      pageToken,
      orderBy: 'modifiedTime desc',
    });

    if (response.data.files) {
      files.push(
        ...response.data.files.map((f) => ({
          id: f.id!,
          name: f.name!,
          mimeType: f.mimeType!,
          webViewLink: f.webViewLink!,
          modifiedTime: f.modifiedTime!,
          createdTime: f.createdTime!,
        }))
      );
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

/**
 * Get changes in a folder since the last sync.
 * Uses Drive's changes API with a startPageToken for efficient polling.
 */
export async function getChanges(
  startPageToken: string | null
): Promise<{
  newFiles: DriveFile[];
  modifiedFiles: DriveFile[];
  nextPageToken: string;
}> {
  const drive = getDriveClient();

  // If no token, get the current token (first sync)
  if (!startPageToken) {
    const tokenRes = await drive.changes.getStartPageToken();
    return {
      newFiles: [],
      modifiedFiles: [],
      nextPageToken: tokenRes.data.startPageToken!,
    };
  }

  const newFiles: DriveFile[] = [];
  const modifiedFiles: DriveFile[] = [];
  let pageToken: string | undefined = startPageToken;
  let newStartPageToken = startPageToken;

  do {
    const response = await drive.changes.list({
      pageToken,
      fields: 'nextPageToken, newStartPageToken, changes(fileId, file(id, name, mimeType, webViewLink, modifiedTime, createdTime, trashed, parents))',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    for (const change of response.data.changes ?? []) {
      const file = change.file;
      if (!file || file.trashed || file.mimeType !== 'application/vnd.google-apps.document') {
        continue;
      }

      const driveFile: DriveFile = {
        id: file.id!,
        name: file.name!,
        mimeType: file.mimeType!,
        webViewLink: file.webViewLink!,
        modifiedTime: file.modifiedTime!,
        createdTime: file.createdTime!,
      };

      // Determine if new or modified based on timestamps
      const created = new Date(file.createdTime!);
      const modified = new Date(file.modifiedTime!);
      const timeDiff = modified.getTime() - created.getTime();

      if (timeDiff < 60000) {
        // Created within last minute = new file
        newFiles.push(driveFile);
      } else {
        modifiedFiles.push(driveFile);
      }
    }

    if (response.data.newStartPageToken) {
      newStartPageToken = response.data.newStartPageToken;
    }
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return { newFiles, modifiedFiles, nextPageToken: newStartPageToken };
}

/**
 * Get the full text content of a Google Doc.
 * Exports as plain text for Copyleaks submission.
 */
export async function getDocContent(docId: string): Promise<string> {
  const drive = getDriveClient();
  
  const response = await drive.files.export({
    fileId: docId,
    mimeType: 'text/plain',
  });

  return response.data as string;
}

/**
 * Get the HTML content of a Google Doc.
 * Useful for preserving formatting in reports.
 */
export async function getDocHtml(docId: string): Promise<string> {
  const drive = getDriveClient();
  
  const response = await drive.files.export({
    fileId: docId,
    mimeType: 'text/html',
  });

  return response.data as string;
}

/**
 * Add a comment to a Google Doc with scan results summary.
 * This is how editors see results directly in the document.
 */
export async function addScanResultComment(
  docId: string,
  results: {
    plagiarismScore: number;
    aiScore: number;
    grammarScore: number | null;
    readabilityGrade: string | null;
    topSources: Array<{ url: string; percentage: number }>;
    dashboardUrl: string;
  }
): Promise<void> {
  const drive = getDriveClient();

  // Build comment text
  const lines = [
    '📊 Content Review Scan Results',
    '─'.repeat(35),
    '',
    `🔍 Plagiarism: ${results.plagiarismScore.toFixed(1)}%`,
    `🤖 AI Detection: ${(results.aiScore * 100).toFixed(0)}% AI-generated`,
  ];

  if (results.grammarScore !== null) {
    lines.push(`✍️ Writing Quality: ${results.grammarScore.toFixed(0)}/100`);
  }
  if (results.readabilityGrade) {
    lines.push(`📖 Readability: ${results.readabilityGrade}`);
  }

  if (results.topSources.length > 0) {
    lines.push('', '⚠️ Top Matched Sources:');
    results.topSources.slice(0, 3).forEach((src, i) => {
      lines.push(`  ${i + 1}. ${src.url} (${src.percentage.toFixed(1)}%)`);
    });
  }

  lines.push('', `📋 Full report: ${results.dashboardUrl}`);

  await drive.comments.create({
    fileId: docId,
    fields: 'id',
    requestBody: {
      content: lines.join('\n'),
    },
  });
}

/**
 * Get word count for a document (approximate).
 */
export async function getWordCount(docId: string): Promise<number> {
  const content = await getDocContent(docId);
  return content.split(/\s+/).filter(Boolean).length;
}
