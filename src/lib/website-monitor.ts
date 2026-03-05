import { prisma } from '@/lib/db';
import { callGemini, parseGeminiJson } from '@/lib/gemini';

// ── Page path patterns ─────────────────────────────────────
const PAGE_PATTERNS: Record<string, string[]> = {
  team: ['/about', '/our-team', '/meet-the-team', '/doctors', '/team', '/about-us', '/staff', '/meet-our-team', '/our-doctors'],
  services: ['/services', '/dental-services', '/our-services', '/treatments', '/what-we-do'],
  contact: ['/contact', '/contact-us', '/hours', '/location', '/locations'],
};

// ── HTML stripping ─────────────────────────────────────────
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 15000); // Limit to ~15k chars per page
}

// ── Scrape a single URL ────────────────────────────────────
async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ContentReviewBot/1.0' },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    if (res.ok) {
      const html = await res.text();
      return stripHtml(html);
    }
  } catch {
    // ignore
  }
  return null;
}

// ── Find and scrape best matching page ─────────────────────
async function findAndScrape(baseUrl: string, paths: string[]): Promise<string | null> {
  for (const path of paths) {
    try {
      const url = new URL(path, baseUrl).href;
      const text = await fetchPage(url);
      if (text && text.length > 100) return text;
    } catch { continue; }
  }
  return null;
}

// ── Change detection result ────────────────────────────────
interface DetectedChange {
  changeType: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  severity: string;
}

// ── Core website check logic ───────────────────────────────
export async function checkPracticeWebsite(practiceId: string): Promise<DetectedChange[]> {
  const practice = await prisma.practice.findUnique({
    where: { id: practiceId },
    include: {
      doctors: true,
      services: true,
      bannedPhrases: true,
      styleRules: true,
    },
  });

  if (!practice) throw new Error('Practice not found');
  if (!practice.website) throw new Error('No website configured for this practice');

  const baseUrl = practice.website.endsWith('/') ? practice.website : practice.website + '/';

  // Scrape key pages
  const [homepage, teamPage, servicesPage, contactPage] = await Promise.all([
    fetchPage(baseUrl),
    findAndScrape(baseUrl, PAGE_PATTERNS.team),
    findAndScrape(baseUrl, PAGE_PATTERNS.services),
    findAndScrape(baseUrl, PAGE_PATTERNS.contact),
  ]);

  if (!homepage && !teamPage && !servicesPage && !contactPage) {
    throw new Error('Could not reach practice website — all pages failed to load');
  }

  // Build Gemini prompt
  const doctorsList = practice.doctors.map(d => `${d.fullName} (${d.preferredFormat}) - ${d.role || 'Staff'}`);
  const servicesList = practice.services.map(s => `${s.serviceName} (${s.isOffered ? 'offered' : 'NOT offered'})`);

  const prompt = `You are a dental practice brand guide monitor. Compare the current website content against the stored brand guide data and identify any changes or discrepancies.

CURRENT BRAND GUIDE:
Practice: ${practice.name}
Doctors: ${JSON.stringify(doctorsList)}
Services: ${JSON.stringify(servicesList)}
Website: ${practice.website}

SCRAPED WEBSITE CONTENT:

--- Homepage ---
${homepage || '(could not load)'}

--- Team/About Page ---
${teamPage || '(could not load)'}

--- Services Page ---
${servicesPage || '(could not load)'}

--- Contact Page ---
${contactPage || '(could not load)'}

Compare the website content against the brand guide and identify any changes. Return a JSON array of detected changes:

[
  {
    "changeType": "doctor_added|doctor_removed|service_added|service_removed|hours_changed|team_changed|contact_changed|other",
    "field": "Which brand guide field is affected (e.g., 'doctors', 'services')",
    "oldValue": "What the brand guide currently says (null if new addition)",
    "newValue": "What the website now shows (null if removed)",
    "severity": "error|warning|info"
  }
]

IMPORTANT:
- Only report REAL changes - don't flag things just because the website words them differently
- Doctor/team member additions or removals are "warning" severity
- Service additions are "info", service removals are "warning"
- Contact info changes (phone, address, hours) are "warning"
- If no changes detected, return an empty array []
- Return ONLY valid JSON, no markdown formatting.`;

  const raw = await callGemini(prompt);
  let changes: DetectedChange[];

  try {
    changes = parseGeminiJson<DetectedChange[]>(raw);
    if (!Array.isArray(changes)) changes = [];
  } catch {
    console.error('[WebsiteMonitor] Failed to parse Gemini response:', raw.slice(0, 500));
    changes = [];
  }

  // Save changes to database
  if (changes.length > 0) {
    await prisma.websiteChange.createMany({
      data: changes.map(c => ({
        practiceId,
        changeType: c.changeType,
        field: c.field,
        oldValue: c.oldValue || null,
        newValue: c.newValue || null,
        severity: c.severity || 'info',
      })),
    });
  }

  // Update practice snapshot and check timestamp
  const snapshot = {
    homepage: homepage?.slice(0, 5000) || null,
    teamPage: teamPage?.slice(0, 5000) || null,
    servicesPage: servicesPage?.slice(0, 5000) || null,
    contactPage: contactPage?.slice(0, 5000) || null,
  };

  await prisma.practice.update({
    where: { id: practiceId },
    data: {
      lastWebsiteCheck: new Date(),
      websiteSnapshot: snapshot,
    },
  });

  return changes;
}
