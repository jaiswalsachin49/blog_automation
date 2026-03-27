import { callGemini } from "../gemini";

const SYSTEM_PROMPT = `You are an expert SEO auditor who scores blog content against industry-standard SEO metrics.

You will receive a blog post (Markdown) and the original brief it was written from. Score the blog on EXACTLY these 10 metrics. Be honest and precise — don't inflate scores.

Scoring Guidelines:

1. **Keyword Density** (weight: 15%)
   - Count occurrences of primary keyword / total word count
   - Target: 1-2% → PASS, <0.5% or >3% → FAIL

2. **Readability Score** (weight: 10%)
   - Assess Flesch-Kincaid grade level based on sentence length and word complexity
   - Target: Grade 8-10 → PASS, >12 → FAIL

3. **Heading Structure** (weight: 10%)
   - Check H1→H2→H3 hierarchy, no level skips
   - Target: Perfect hierarchy → PASS

4. **AI Detection Risk** (weight: 15%)
   - Assess naturalness of writing — varied sentence structure, conversational tone, imperfections
   - Score as percentage (0% = fully human, 100% = clearly AI)
   - Target: <25% → PASS

5. **Snippet Readiness** (weight: 10%)
   - Does the intro paragraph answer the main query in ≤50 words?
   - Is it structured to win a featured snippet?
   - Target: Yes → PASS

6. **Meta Description Quality** (weight: 5%)
   - Is meta description present, 150-160 chars, includes keyword, has CTA?
   - Target: All criteria met → PASS

7. **Internal Linking** (weight: 10%)
   - Count contextual internal links with descriptive anchor text
   - Target: 3-5 links → PASS

8. **Word Count Compliance** (weight: 5%)
   - Compare actual word count vs brief's target
   - Target: Within ±10% → PASS

9. **Keyword Placement** (weight: 10%)
   - Primary keyword in: title, first paragraph, at least one H2, conclusion
   - Target: All 4 placements → PASS

10. **GEO Optimization** (weight: 10%)
    - FAQ section present? Structured for schema markup? Regional relevance?
    - Target: FAQ present + structured → PASS

Return ONLY valid JSON:
{
  "overall_score": 85,
  "overall_grade": "A|B|C|D|F",
  "total_word_count": 2150,
  "metrics": [
    {
      "name": "Keyword Density",
      "score": 90,
      "value": "1.4%",
      "target": "1-2%",
      "status": "pass",
      "weight": 15,
      "details": "Primary keyword 'AI blog' found 12 times in 850 words"
    }
  ],
  "strengths": ["Strength 1", "Strength 2"],
  "improvements": ["Improvement suggestion 1", "Improvement suggestion 2"],
  "summary": "One-paragraph summary of overall SEO quality"
}`;

/**
 * Stage 8: Score the blog against 10 SEO metrics
 * @param {string} blog - The humanized blog Markdown
 * @param {object} brief - The original brief for comparison
 * @returns {Promise<object>} - SEO scorecard JSON
 */
async function scoreSEO(blog: any, brief: any) {
  const userMessage = `Score this blog post against the 10 SEO metrics:

BLOG BRIEF (for reference):
- Title: ${brief.title}
- Target Word Count: ${brief.target_word_count}
- Primary Keywords: ${brief.primary_keywords.join(", ")}
- Secondary Keywords: ${brief.secondary_keywords.join(", ")}
- Expected Internal Links: ${brief.internal_links.length}

BLOG CONTENT:
${blog}`;

  const result = await callGemini(SYSTEM_PROMPT, userMessage, { json: true });
  return result;
}

export { scoreSEO };
