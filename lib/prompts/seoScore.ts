import { callLLM } from "../llm";
import type { BlogBrief } from "./generateBrief";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface MetricResult {
  name: string;
  score: number;
  value: string;
  target: string;
  status: "pass" | "fail" | "warning";
  weight: number;
  details: string;
  improvement: string;
}

interface SEOScorecard {
  overall_score: number;
  overall_grade: "A" | "B" | "C" | "D" | "F";
  total_word_count: number;
  estimated_read_time: string;
  keyword_density_actual: string;
  metrics: MetricResult[];
  strengths: string[];
  improvements: string[];
  critical_failures: string[];
  publish_ready: boolean;
  publish_verdict: string;
  summary: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countWords(markdown: string): number {
  return markdown
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*|__|\\*|_|~~|`{1,3}/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean).length;
}

function countKeywordOccurrences(markdown: string, keyword: string): number {
  const clean = markdown
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*|__|\\*|_|~~|`{1,3}/g, "")
    .toLowerCase();
  const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = clean.match(new RegExp(`\\b${escaped}\\b`, "g"));
  return matches?.length ?? 0;
}

function extractHeadings(markdown: string): { level: number; text: string }[] {
  const headings: { level: number; text: string }[] = [];
  const lines = markdown.split("\n");
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({ level: match[1].length, text: match[2].trim() });
    }
  }
  return headings;
}

function extractInternalLinks(markdown: string): { anchor: string; url: string }[] {
  const links: { anchor: string; url: string }[] = [];
  const regex = /\[([^\]]+)\]\((\/[^)]*)\)/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    links.push({ anchor: match[1], url: match[2] });
  }
  return links;
}

function extractMetaDescription(markdown: string): { text: string; charCount: number } | null {
  const match = markdown.match(/<!--\s*meta:\s*(.*?)\s*-->/i);
  if (match) {
    const text = match[1].trim();
    return { text, charCount: text.length };
  }
  return null;
}

function extractFAQQuestions(markdown: string): string[] {
  const questions: string[] = [];
  const faqSectionMatch = markdown.match(/##\s*(Frequently Asked Questions|FAQ)\s*\n([\s\S]*?)(?=\n##\s[^#]|\n#\s|$)/i);
  if (faqSectionMatch) {
    const faqContent = faqSectionMatch[2];
    const questionMatches = faqContent.matchAll(/###\s+(.+)/g);
    for (const qMatch of questionMatches) {
      questions.push(qMatch[1].trim());
    }
  }
  return questions;
}

function extractIntro(markdown: string): { text: string; wordCount: number } {
  const lines = markdown.split("\n");
  let foundH1 = false;
  let introLines: string[] = [];
  
  for (const line of lines) {
    if (line.match(/^#\s+/)) {
      foundH1 = true;
      continue;
    }
    if (foundH1) {
      if (line.trim() === "") {
        if (introLines.length > 0) break;
        continue;
      }
      if (line.match(/^#{1,6}\s+/)) break;
      introLines.push(line.trim());
    }
  }
  
  const text = introLines.join(" ");
  const wc = text.split(/\s+/).filter(Boolean).length;
  return { text, wordCount: wc };
}

function containsKeyword(text: string, keyword: string): boolean {
  if (!keyword) return false;
  const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior SEO auditor. You score blog content fairly and accurately based on pre-calculated metrics provided to you.

IMPORTANT: You will receive EXTENSIVE pre-calculated metrics. TRUST THEM — they are computed programmatically and are 100% accurate. Do NOT re-count or re-assess anything that has been pre-calculated. Base your scores directly on the provided data.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCORING SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Score each metric 0-100. Be fair — give credit where due:
- 90-100: Excellent — meets or exceeds best practices
- 75-89:  Good — meets best practices with minor issues
- 60-74:  Acceptable — mostly meets best practices
- 40-59:  Warning — needs improvement
- 0-39:   Fail — does not meet best practices

Status: "pass" >= 70, "warning" 50-69, "fail" < 50
Overall score = weighted average. Grade: A (90+), B (80-89), C (70-79), D (60-69), F (<60)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE 10 METRICS — SCORE USING PRE-CALCULATED DATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. KEYWORD DENSITY (weight: 15%)
   Use the pre-calculated density.
   - 1.0–1.8%: 90-100
   - 0.7–0.9% or 1.9–2.5%: 75-89
   - 0.5–0.6% or 2.6–3.0%: 55-74
   - <0.5% or >3.0%: 0-54

2. READABILITY (weight: 10%)
   Assess writing quality:
   - Varied sentences, contractions, conversational: 85-100
   - Mostly readable, some stiff parts: 70-84
   - Overly formal or too simple: 50-69

3. HEADING STRUCTURE (weight: 10%)
   Use pre-calculated heading counts. Start at 95.
   - H1 count != 1: -20
   - H2 count < 5 (excluding FAQ/Conclusion): -10 per missing
   - No H3s at all: -5
   - Skip levels: -10

4. AI DETECTION RISK (weight: 15%)
   Assess writing style:
   - Varied lengths + contractions + opinions + informal: 85-100
   - Mostly natural, some uniform parts: 70-84
   - Clearly AI throughout: below 60

5. SNIPPET READINESS (weight: 10%)
   Use pre-calculated intro word count.
   - 35-65 words + contains keyword + answers query: 90-100
   - Minor deviation: 75-89
   - Major issues: below 70

6. META DESCRIPTION (weight: 5%)
   Use pre-calculated meta data.
   - Present + 140-165 chars + has keyword: 90-100
   - Minor issues (slightly out of range): 75-89
   - Missing: 0

7. INTERNAL LINKING (weight: 10%)
   Use pre-calculated link count.
   - 4+ descriptive links: 90-100
   - 3 links: 75-89
   - 2 links: 55-74
   - 0-1 links: 0-54

8. WORD COUNT (weight: 5%)
   Use pre-calculated difference.
   - Within ±10%: 90-100
   - Within ±15%: 75-89
   - Within ±25%: 55-74
   - Beyond ±25%: 0-54

9. KEYWORD PLACEMENT (weight: 10%)
   Use pre-calculated placement score directly.
   Score = (placements found / 5) × 100
   The pre-calculated score is final for this metric.

10. FAQ / GEO (weight: 10%)
    Use pre-calculated FAQ count.
    - 5+ questions: 90-100
    - 4 questions: 80-89
    - 2-3 questions: 60-79
    - 0-1 questions: 0-54

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PUBLISH VERDICT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- publish_ready: true if overall_score >= 75 AND no metric below 40
- publish_verdict: one sentence

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL FAILURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

List metrics scoring below 40. Empty array if none.

Return ONLY valid JSON:
{
  "overall_score": 85,
  "overall_grade": "B",
  "total_word_count": 2150,
  "estimated_read_time": "9 min read",
  "keyword_density_actual": "1.4%",
  "metrics": [
    {
      "name": "Keyword Density",
      "score": 92,
      "value": "1.4%",
      "target": "1.0–1.8%",
      "status": "pass",
      "weight": 15,
      "details": "Density is 1.4% — ideal range.",
      "improvement": "No changes needed"
    }
  ],
  "strengths": ["Specific strength"],
  "improvements": ["Specific improvement"],
  "critical_failures": [],
  "publish_ready": true,
  "publish_verdict": "Publish decision",
  "summary": "2-3 sentence assessment"
}`;

// ─── Main Function ─────────────────────────────────────────────────────────────

async function scoreSEO(
  blog: string,
  brief: BlogBrief
): Promise<SEOScorecard> {

  // Pre-calculate ALL metrics locally for accuracy
  const wordCount = countWords(blog);
  const primaryKeyword = brief.primary_keywords?.[0] ?? "";
  const keywordCount = primaryKeyword
    ? countKeywordOccurrences(blog, primaryKeyword)
    : 0;
  const keywordDensity = wordCount > 0
    ? ((keywordCount / wordCount) * 100).toFixed(2)
    : "0.00";
  const readTime = `${Math.ceil(wordCount / 200)} min read`;
  const wordCountDiff = brief.target_word_count
    ? (((wordCount - brief.target_word_count) / brief.target_word_count) * 100).toFixed(1)
    : "unknown";

  // Structural metrics
  const headings = extractHeadings(blog);
  const h1s = headings.filter(h => h.level === 1);
  const h2s = headings.filter(h => h.level === 2);
  const h3s = headings.filter(h => h.level === 3);
  const internalLinks = extractInternalLinks(blog);
  const metaDesc = extractMetaDescription(blog);
  const faqQuestions = extractFAQQuestions(blog);
  const intro = extractIntro(blog);

  // Keyword placement
  const kwInTitle = h1s.length > 0 && containsKeyword(h1s[0].text, primaryKeyword);
  const kwInIntro = containsKeyword(intro.text, primaryKeyword);
  const kwInH2 = h2s.some(h => containsKeyword(h.text, primaryKeyword));
  const kwInMeta = metaDesc ? containsKeyword(metaDesc.text, primaryKeyword) : false;
  const conclusionH2 = h2s.find(h => /conclusion|final|wrap|summary|bottom line/i.test(h.text));
  const blogLower = blog.toLowerCase();
  const concIdx = conclusionH2
    ? blogLower.lastIndexOf(conclusionH2.text.toLowerCase())
    : blogLower.lastIndexOf("## ");
  const conclusionText = concIdx > 0 ? blog.substring(concIdx) : "";
  const kwInConclusion = containsKeyword(conclusionText, primaryKeyword);
  const placementCount = [kwInTitle, kwInIntro, kwInH2, kwInConclusion, kwInMeta].filter(Boolean).length;

  const userMessage = `Score this blog using the pre-calculated metrics below. TRUST these numbers — they are programmatically computed and accurate. Do NOT re-count anything yourself.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRE-CALCULATED METRICS (100% ACCURATE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WORD COUNT:
- Total: ${wordCount} words | Target: ${brief.target_word_count} words
- Difference: ${wordCountDiff}% ${Number(wordCountDiff) > 0 ? "over" : "under"} target

KEYWORD:
- Primary: "${primaryKeyword}" | Occurrences: ${keywordCount} | Density: ${keywordDensity}%

HEADINGS:
- H1 (${h1s.length}): ${h1s.map(h => `"${h.text}"`).join(", ") || "NONE"}
- H2 (${h2s.length}): ${h2s.map(h => `"${h.text}"`).join(", ") || "NONE"}
- H3 (${h3s.length}): ${h3s.map(h => `"${h.text}"`).join(", ") || "NONE"}

INTERNAL LINKS (${internalLinks.length}):
${internalLinks.map(l => `- [${l.anchor}](${l.url})`).join("\n") || "- NONE"}

META DESCRIPTION:
- Present: ${metaDesc ? "YES" : "NO"} | Chars: ${metaDesc?.charCount ?? 0} | Text: "${metaDesc?.text ?? "MISSING"}"

FAQ QUESTIONS (${faqQuestions.length}):
${faqQuestions.map((q, i) => `- ${i + 1}. ${q}`).join("\n") || "- NONE"}

INTRO: ${intro.wordCount} words | Keyword present: ${kwInIntro ? "YES" : "NO"}

KEYWORD PLACEMENT (${placementCount}/5 = score ${placementCount * 20}):
- Title: ${kwInTitle ? "✅" : "❌"} | Intro: ${kwInIntro ? "✅" : "❌"} | H2: ${kwInH2 ? "✅" : "❌"} | Conclusion: ${kwInConclusion ? "✅" : "❌"} | Meta: ${kwInMeta ? "✅" : "❌"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BLOG CONTENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${blog}`;

  // seoScore sends full blog + metrics (~8K+ tokens).
  const result = await callLLM(SYSTEM_PROMPT, userMessage, { json: true });
  return result as SEOScorecard;
}

export { scoreSEO };
export type { SEOScorecard, MetricResult };