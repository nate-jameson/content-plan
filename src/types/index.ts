// ============================================================
// Content Review Dashboard — Type Definitions
// ============================================================

// Writer with computed stats for dashboard display
export interface WriterWithStats {
  id: string;
  name: string;
  email: string;
  driveFolderId: string;
  driveFolderName: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  totalArticles: number;
  avgPlagiarism: number;
  avgAiScore: number;
  avgGrammarScore: number;
  // Computed
  articlesThisMonth: number;
  pendingReview: number;
  flaggedCount: number;
}

// Article with scan summary for list views
export interface ArticleWithScan {
  id: string;
  writerId: string;
  writerName: string;
  googleDocId: string;
  title: string;
  driveUrl: string;
  wordCount: number | null;
  status: ArticleStatus;
  detectedAt: string;
  completedAt: string | null;
  scanResult: ScanSummary | null;
}

export type ArticleStatus =
  | 'DETECTED'
  | 'QUEUED'
  | 'SCANNING'
  | 'COMPLETED'
  | 'REVIEWED'
  | 'APPROVED'
  | 'FLAGGED'
  | 'ERROR'
  | 'ARCHIVED';

// Compact scan data for article list cards
export interface ScanSummary {
  plagiarismScore: number;
  aiScore: number;
  humanScore: number;
  grammarScore: number | null;
  readabilityGrade: string | null;
  readingTimeMinutes: number | null;
  sourceCount: number;
  pdfReportUrl: string | null;
}

// Full scan detail for drill-down view
export interface ScanDetail extends ScanSummary {
  id: string;
  copyleaksScanId: string;
  matchedWords: number;
  totalWords: number;
  mechanicsScore: number | null;
  sentenceStructure: number | null;
  wordChoice: number | null;
  sources: PlagiarismSource[];
  paragraphs: AiParagraphDetail[];
  scannedAt: string;
}

export interface PlagiarismSource {
  id: string;
  sourceUrl: string;
  sourceTitle: string | null;
  matchedWords: number;
  percentage: number;
  isInternetSource: boolean;
}

export interface AiParagraphDetail {
  paragraphIndex: number;
  text: string;
  classification: 'ai' | 'human' | 'mixed';
  aiProbability: number;
}

// ============================================================
// Copyleaks Webhook Payloads
// ============================================================

export interface CopyleaksWebhookPayload {
  scannedDocument: {
    scanId: string;
    totalWords: number;
    totalExcluded: number;
    credits: number;
    creationTime: string;
    developerPayload?: string;
  };
  results: {
    internet: CopyleaksResultItem[];
    database: CopyleaksResultItem[];
    batch: CopyleaksResultItem[];
    score: {
      identicalWords: number;
      minorChangedWords: number;
      relatedMeaningWords: number;
      aggregatedScore: number;
    };
  };
  aiDetection?: {
    summary: {
      ai: number;
      human: number;
    };
    classifications: Array<{
      classification: string;
      ai: number;
      human: number;
    }>;
  };
  writingFeedback?: {
    overallScore: number;
    corrections: {
      grammar: { score: number };
      mechanics: { score: number };
      sentenceStructure: { score: number };
      wordChoice: { score: number };
    };
    readability: {
      gradeLevel: string;
      readingTime: number;
    };
  };
}

export interface CopyleaksResultItem {
  id: string;
  url: string;
  title: string;
  introduction: string;
  matchedWords: number;
  metadata: {
    finalScore: number;
  };
}

// ============================================================
// Dashboard Filter/Sort State
// ============================================================

export interface DashboardFilters {
  writerId: string | null;
  status: ArticleStatus | 'ALL';
  dateRange: 'week' | 'month' | 'quarter' | 'all';
  sortBy: 'date' | 'plagiarism' | 'ai' | 'grammar' | 'status';
  sortOrder: 'asc' | 'desc';
  searchQuery: string;
}

// ============================================================
// API Response Wrappers
// ============================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
