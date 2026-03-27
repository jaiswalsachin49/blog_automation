import { callGemini } from "../gemini";

const SYSTEM_PROMPT = `You are a senior SEO competitive analyst specializing in SERP (Search Engine Results Page) gap analysis.

You will receive a keyword cluster with intent analysis. Your job is to simulate analyzing the top 10 Google results for the primary keyword and identify:

1. **Content Gaps** — Questions that existing top-ranking articles typically FAIL to answer adequately. Be specific (not generic like "more detail needed").
2. **Saturated Angles** — Approaches/angles that are overdone and won't help a new article rank (everyone already covers these).
3. **Outdated Information** — Topics where existing articles likely contain pre-2024 information that has changed.
4. **Missing Perspectives** — Viewpoints, audiences, or use cases that existing content ignores (e.g., India-specific, small business focused, non-English, budget-conscious).
5. **Format Gaps** — Content formats that no one uses for this topic but would be valuable (comparison tables, case studies, video embeds, calculators, templates).

For each gap, assign a priority (high / medium / low) based on ranking potential.

Finally, synthesize the best unique angle for a new article that would have the highest chance of outranking existing content.

Return ONLY valid JSON:
{
  "serp_analysis_summary": "Brief description of what typical top results look like",
  "gaps": [
    {
      "gap": "Specific content gap description",
      "opportunity": "What to include to fill this gap",
      "priority": "high|medium|low",
      "estimated_impact": "Why this gap matters for ranking"
    }
  ],
  "saturated_angles": ["Angle 1 description", "Angle 2 description"],
  "outdated_info": ["Outdated topic 1", "Outdated topic 2"],
  "missing_perspectives": ["Missing perspective 1", "Missing perspective 2"],
  "format_gaps": ["Format gap 1", "Format gap 2"],
  "recommended_unique_angle": "The single best angle combining the highest-priority gaps",
  "content_strategy": "Brief strategy on how to structure the blog to exploit these gaps"
}`;

/**
 * Stage 3: Simulate SERP analysis and find content gaps
 * @param {object} keywordData - Output from intentAnalysis
 * @returns {Promise<object>} - SERP gap analysis JSON
 */
async function findSerpGaps(keywordData: any) {
  const userMessage = `Analyze the SERP landscape for this keyword cluster and find content gaps:

Seed Keyword: "${keywordData.seed}"
Primary Intent: ${keywordData.primary_intent}
Intent Reasoning: ${keywordData.intent_reasoning}

Full Keyword Cluster:
${JSON.stringify(keywordData.keyword_clusters, null, 2)}

All Keywords: ${keywordData.all_keywords.join(", ")}`;

  const result = await callGemini(SYSTEM_PROMPT, userMessage, { json: true });
  return result;
}

export { findSerpGaps };
