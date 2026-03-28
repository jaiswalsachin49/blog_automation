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

/**
 * Roughly count words in a markdown string
 * Strips markdown syntax before counting
 */
function countWords(markdown: string): number {
  return markdown
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*|__|\*|_|~~|`{1,3}/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean).length;
}

/**
 * Count keyword occurrences in markdown (case-insensitive)
 */
function countKeywordOccurrences(markdown: string, keyword: string): number {
  const clean = markdown
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*|__|\*|_|~~|`{1,3}/g, "")
    .toLowerCase();
  const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = clean.match(new RegExp(`\\b${escaped}\\b`, "g"));
  return matches?.length ?? 0;
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior SEO auditor with expertise in technical SEO, 
content quality analysis, and ranking factors. You score blog content with surgical 
precision — no inflated scores, no vague feedback.

You will receive:
1. A complete blog post in Markdown
2. The original brief it was written from
3. Pre-calculated metrics (word count, keyword density) for accuracy

Your job is to audit the blog against 10 weighted SEO metrics and return an honest, 
detailed scorecard.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCORING SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Score each metric 0-100. Be strict:
- 90-100: Excellent — exceeds best practices
- 70-89:  Good — meets best practices with minor issues
- 50-69:  Warning — partially meets best practices, needs improvement
- 0-49:   Fail — does not meet best practices, will hurt rankings

Status thresholds:
- "pass": score >= 70
- "warning": score 50-69
- "fail": score < 50

Overall score = weighted average of all 10 metrics.
Overall grade: A (90+), B (80-89), C (70-79), D (60-69), F (<60)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE 10 METRICS — EXACT SCORING CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. KEYWORD DENSITY (weight: 15%)
   Use the pre-calculated density provided — do not recalculate.
   Scoring:
   - 1.0–1.8%: 90-100 (ideal range)
   - 0.8–0.9% or 1.9–2.2%: 70-89 (acceptable)
   - 0.5–0.7% or 2.3–2.9%: 40-69 (warning — too sparse or borderline stuffing)
   - <0.5%: 0-39 (fail — keyword barely present)
   - >3.0%: 0-39 (fail — keyword stuffing, Google penalty risk)
   Detail: State exact density % and occurrence count

2. READABILITY SCORE (weight: 10%)
   Assess Flesch-Kincaid grade level by analyzing:
   - Average sentence length (count words per sentence in a sample of 10 sentences)
   - Average syllables per word (estimate from vocabulary complexity)
   - Use of passive voice (penalize heavily)
   - Paragraph length (3-4 sentences ideal)
   Scoring:
   - Grade 7-9: 90-100 (ideal — accessible but not dumbed down)
   - Grade 6 or 10: 75-89 (slightly too simple or complex)
   - Grade 5 or 11-12: 50-74 (warning)
   - Grade <5 or >12: 0-49 (fail)
   Detail: Estimate actual grade level and explain why

3. HEADING STRUCTURE (weight: 10%)
   Check ALL of the following:
   - Single H1 present (the title)
   - H2s present (minimum 5)
   - H3s used where appropriate for sub-sections
   - No heading level skipped (H1→H3 without H2 = fail)
   - Primary keyword appears in at least 1 H2 naturally
   - Headings are descriptive (not just "Introduction" or "Conclusion")
   Scoring: -15 points for each violation. Start at 100.
   Detail: List each heading and flag any violations

4. AI DETECTION RISK (weight: 15%)
   This is critical. Assess the writing for AI patterns:
   
   HIGH RISK signals (each adds 15-20% to AI score):
   - Uniform sentence length throughout
   - Phrases: "In today's world", "It is important to note", "Moreover", 
     "Furthermore", "It is worth mentioning", "Delve into", "Leverage",
     "Cutting-edge", "Robust", "Crucial", "Vital", "Transformative"
   - Every paragraph exactly 3-4 sentences
   - Overly balanced structure (pros always followed by cons, exactly)
   - No personal opinions or strong stances
   - No informal language or contractions
   - Generic examples without specifics
   
   LOW RISK signals (each reduces AI score by 10-15%):
   - Varied sentence lengths (mix of 5-word and 30-word sentences)
   - Contractions used naturally (it's, you'll, don't)
   - Strong opinions stated directly
   - Specific numbers, examples, or case studies
   - Rhetorical questions
   - Sentence fragments used deliberately
   - Informal asides (parenthetical remarks)
   
   Score as AI Detection Risk %:
   - <20%: score 90-100 (passes — likely human)
   - 20-35%: score 70-89 (acceptable — minor AI patterns)
   - 35-55%: score 40-69 (warning — clearly AI-assisted)
   - >55%: score 0-39 (fail — will be flagged by detectors)
   
   Detail: List specific phrases or patterns that raised/lowered the score

5. SNIPPET READINESS (weight: 10%)
   Check the intro paragraph:
   - Is it 40-60 words? (±5 words tolerance)
   - Does the first sentence directly answer the main query?
   - Is it written as a definition or direct answer (not a question)?
   - Does it avoid starting with "I", "We", or the blog title?
   - Could it stand alone as a complete answer?
   Scoring:
   - All criteria met: 90-100
   - 4/5 criteria met: 70-89
   - 3/5 criteria met: 50-69
   - <3/5 criteria met: 0-49
   Detail: Quote the actual intro and explain each criterion pass/fail

6. META DESCRIPTION QUALITY (weight: 5%)
   Check for <!-- meta: ... --> comment at top of blog.
   Verify ALL of:
   - Present in the blog
   - 150-160 characters (count exactly)
   - Primary keyword in first 60 characters
   - Ends with action-oriented CTA
   - Accurately describes the article content
   - No truncation (doesn't end mid-sentence)
   Scoring: -20 points per failed criterion. Start at 100.
   Detail: Quote the meta description and check each criterion

7. INTERNAL LINKING (weight: 10%)
   Count all internal link suggestions in the blog.
   Check:
   - Minimum 3 internal links present
   - Anchor text is descriptive (not "click here" or "read more")
   - Links placed contextually (relevant to surrounding content)
   - Not clustered in one section
   Scoring:
   - 4-5 links, all contextual: 90-100
   - 3 links, all contextual: 75-89
   - 2 links or poor anchor text: 50-74
   - 0-1 links: 0-49
   Detail: List each link anchor text and placement

8. WORD COUNT COMPLIANCE (weight: 5%)
   Use the pre-calculated word count provided.
   Compare to brief's target word count.
   Scoring:
   - Within ±5% of target: 95-100
   - Within ±10% of target: 80-94
   - Within ±20% of target: 60-79
   - More than ±20% off target: 0-59
   Detail: State actual vs target and percentage difference

9. KEYWORD PLACEMENT (weight: 10%)
   Check primary keyword appears in ALL of:
   - Title/H1 ← most critical
   - First 100 words of body content
   - At least one H2 heading
   - Conclusion section
   - Meta description
   Scoring: Each placement = 20 points. Max 100.
   Detail: Confirm or deny each placement with exact quote

10. GEO OPTIMIZATION (weight: 10%)
    Check ALL of:
    - FAQ section present with minimum 4 questions
    - FAQ questions are in natural language (voice search friendly)
    - FAQ answers are concise (40-60 words each — schema markup friendly)
    - Regional/local context addressed if keyword warrants it
    - Structured data friendly (Q&A format clean)
    Scoring:
    - All criteria met: 90-100
    - FAQ present but short (2-3 questions): 60-79
    - No FAQ section: 0-39
    Detail: List FAQ questions and assess quality

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PUBLISH VERDICT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After scoring, determine if the blog is publish-ready:
- publish_ready: true ONLY if overall_score >= 75 AND no metric scores below 40
- If any metric scores below 40: publish_ready = false (critical failure)
- publish_verdict: one sentence explaining the decision

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL FAILURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

List any metrics that scored below 40 as critical_failures.
These must be fixed before publishing.
If none, return empty array.

Return ONLY valid JSON in this exact structure:
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
      "details": "Primary keyword found 30 times in 2150 words = 1.4% density. Ideal range.",
      "improvement": "No changes needed — maintain this density in any edits"
    }
  ],
  "strengths": [
    "Specific strength with evidence from the blog"
  ],
  "improvements": [
    "Specific, actionable improvement with exact location in blog"
  ],
  "critical_failures": [
    "Metric name: specific reason it failed and exactly how to fix it"
  ],
  "publish_ready": true,
  "publish_verdict": "One sentence explaining publish decision",
  "summary": "2-3 sentence overall assessment of SEO quality and ranking potential"
}`;

// ─── Main Function ─────────────────────────────────────────────────────────────

/**
 * Stage 8: Score the humanized blog against 10 SEO metrics
 * @param blog - The humanized blog Markdown from humanize()
 * @param brief - The original brief from createBrief()
 * @returns Detailed SEO scorecard JSON
 */
async function scoreSEO(
  blog: string,
  brief: BlogBrief
): Promise<SEOScorecard> {

  // Pre-calculate metrics locally for accuracy
  // This prevents the LLM from guessing word count or keyword density
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
  const internalLinksExpected = brief.internal_links?.length ?? 0;

  const userMessage = `Score this blog post against the 10 SEO metrics.
Be strict and precise — do not inflate scores.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRE-CALCULATED METRICS (use these — do not recalculate)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Word Count: ${wordCount} words
Target Word Count: ${brief.target_word_count} words
Word Count Difference: ${wordCountDiff}% ${Number(wordCountDiff) > 0 ? "over" : "under"} target
Primary Keyword: "${primaryKeyword}"
Keyword Occurrences: ${keywordCount} times
Keyword Density: ${keywordDensity}%
Estimated Read Time: ${readTime}
Expected Internal Links: ${internalLinksExpected}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ORIGINAL BRIEF (for comparison)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Title: ${brief.title}
Target Word Count: ${brief.target_word_count}
Primary Keywords: ${brief.primary_keywords?.join(", ")}
Secondary Keywords: ${brief.secondary_keywords?.join(", ")}
Expected Internal Links: ${internalLinksExpected}
Expected FAQ Questions: ${brief.faq_section?.length ?? 0}
CTA Text: ${brief.cta?.cta_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BLOG CONTENT TO SCORE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${blog}`;

  const result = await callLLM(SYSTEM_PROMPT, userMessage, { json: true });
  return result as SEOScorecard;
}

export { scoreSEO };
export type { SEOScorecard, MetricResult };