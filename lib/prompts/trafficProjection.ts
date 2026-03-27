import { callLLM } from "../llm";

const SYSTEM_PROMPT = `You are an SEO traffic analyst and search demand forecaster.

Given keyword cluster data and SERP gap analysis, estimate the traffic potential for a new blog post targeting these keywords. Use your knowledge of typical search volumes, click-through rates by position, and content competition levels.

You must estimate:
1. **Monthly search volume ranges** for the primary keyword and total cluster
2. **Realistic ranking target** — for new, well-optimized content in months 1-6
3. **CTR estimates** at projected ranking positions
4. **Monthly organic traffic projections** over 6 months
5. **Monetization potential** — CPC range, affiliate/ad revenue estimates
6. **Competition level** — how hard it will be to rank

Be realistic, not optimistic. Base estimates on typical search patterns for similar keywords.

Return ONLY valid JSON:
{
  "primary_keyword_volume": {
    "estimated_range": { "low": 800, "high": 2500 },
    "confidence": "medium",
    "reasoning": "Why this estimate"
  },
  "cluster_total_volume": {
    "estimated_range": { "low": 3000, "high": 10000 },
    "confidence": "medium"
  },
  "competition_level": "medium|low|high",
  "competition_reasoning": "Why this competition level",
  "ranking_projections": {
    "month_1": { "position": 15, "ctr": "1.2%", "estimated_visits": 30 },
    "month_3": { "position": 8, "ctr": "3.5%", "estimated_visits": 120 },
    "month_6": { "position": 5, "ctr": "5.5%", "estimated_visits": 280 }
  },
  "monetization": {
    "avg_cpc_usd": "$0.35",
    "affiliate_potential": "medium",
    "monthly_ad_revenue_estimate": "$10-30 at scale",
    "lead_gen_value": "Description of lead generation potential"
  },
  "traffic_summary": "One-paragraph summary of the traffic opportunity"
}`;

/**
 * Stage 4: Project traffic potential for the keyword cluster
 * @param {object} keywordData - Output from intentAnalysis
 * @param {object} gapData - Output from serpGapResearch
 * @returns {Promise<object>} - Traffic projection JSON
 */
async function projectTraffic(keywordData: any, gapData: any) {
  const userMessage = `Estimate traffic potential for this keyword cluster:

Seed Keyword: "${keywordData.seed}"
Primary Intent: ${keywordData.primary_intent}
Total Keywords in Cluster: ${keywordData.total_keywords}
All Keywords: ${keywordData.all_keywords.join(", ")}

Competition Context (from SERP gap analysis):
- Saturated angles: ${gapData.saturated_angles.join("; ")}
- Number of gaps found: ${gapData.gaps.length}
- Recommended angle: ${gapData.recommended_unique_angle}
- Competition level hints: ${gapData.serp_analysis_summary}`;

  const result = await callLLM(SYSTEM_PROMPT, userMessage, { json: true });
  return result;
}

export { projectTraffic };
