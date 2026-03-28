import { callLLM } from "../llm";

interface VolumeRange {
  low: number;
  high: number;
}

interface VolumeEstimate {
  estimated_range: VolumeRange;
  confidence: "low" | "medium" | "high";
  reasoning: string;
}

interface MonthProjection {
  position: number;
  ctr: string;
  estimated_visits: number;
}

interface RankingProjections {
  month_1: MonthProjection;
  month_3: MonthProjection;
  month_6: MonthProjection;
}

interface Monetization {
  avg_cpc_usd: string;
  affiliate_potential: "low" | "medium" | "high";
  monthly_ad_revenue_estimate: string;
  lead_gen_value: string;
}

interface TrafficProjection {
  primary_keyword_volume: VolumeEstimate;
  cluster_total_volume: Omit<VolumeEstimate, "reasoning">;
  competition_level: "low" | "medium" | "high";
  competition_reasoning: string;
  ranking_projections: RankingProjections;
  monetization: Monetization;
  traffic_summary: string;
  disclaimer: string;
}

interface KeywordAnalysis {
  seed: string;
  primary_intent: string;
  all_keywords: string[];
  total_keywords: number;
}

interface SerpGapData {
  saturated_angles: string[];
  gaps: Array<{ gap: string; priority: string }>;
  recommended_unique_angle: string;
  serp_analysis_summary: string;
}

const SYSTEM_PROMPT = `You are an SEO traffic analyst and search demand forecaster.

Given keyword cluster data and SERP gap analysis, estimate the traffic potential for a 
new blog post targeting these keywords. Use your knowledge of typical search volumes, 
click-through rates by position, and content competition levels.

You must estimate:
1. Monthly search volume ranges for the primary keyword and total cluster
2. Realistic ranking target — for new, well-optimized content in months 1-6
3. CTR estimates at projected ranking positions
4. Monthly organic traffic projections over 6 months
5. Monetization potential — CPC range, affiliate/ad revenue estimates
6. Competition level — how hard it will be to rank

IMPORTANT RULES:
- Be realistic and conservative, not optimistic
- New content rarely ranks in month 1 — reflect this honestly
- If the keyword targets Indian audiences, use Indian CPC ranges ($0.05–$0.20 USD)
- If the keyword targets US/global audiences, use standard CPC ranges ($0.20–$2.00 USD)
- Base all estimates on typical search patterns for similar keywords
- All volume numbers are AI-estimated based on keyword patterns, not live data

REALISTIC RANKING TIMELINE FOR NEW CONTENT:
- Month 1: Position 40-60 (essentially no traffic)
- Month 3: Position 15-30 (minimal traffic)
- Month 6: Position 8-15 (moderate traffic begins)

Return ONLY valid JSON in this exact structure:
{
  "primary_keyword_volume": {
    "estimated_range": { "low": 800, "high": 2500 },
    "confidence": "medium",
    "reasoning": "Why this estimate was chosen based on keyword patterns"
  },
  "cluster_total_volume": {
    "estimated_range": { "low": 3000, "high": 10000 },
    "confidence": "medium"
  },
  "competition_level": "medium",
  "competition_reasoning": "Why this competition level was assigned",
  "ranking_projections": {
    "month_1": { "position": 52, "ctr": "0.1%", "estimated_visits": 2 },
    "month_3": { "position": 22, "ctr": "0.8%", "estimated_visits": 25 },
    "month_6": { "position": 11, "ctr": "2.5%", "estimated_visits": 90 }
  },
  "monetization": {
    "avg_cpc_usd": "$0.12",
    "affiliate_potential": "medium",
    "monthly_ad_revenue_estimate": "$5-15 at scale",
    "lead_gen_value": "Description of lead generation potential"
  },
  "traffic_summary": "One-paragraph realistic summary of the traffic opportunity",
  "disclaimer": "Volumes are AI-estimated based on keyword patterns. Verify with SEMrush or Ahrefs for accurate data."
}`;

/**
 * Stage 4: Project traffic potential for the keyword cluster
 * @param keywordData - Output from intentAnalysis
 * @param gapData - Output from serpGapResearch
 * @returns Structured traffic projection JSON
 */
async function projectTraffic(
  keywordData: KeywordAnalysis,
  gapData: SerpGapData
): Promise<TrafficProjection> {
  
  const saturatedAngles = gapData.saturated_angles?.join("; ") || "None identified";
  const gapsCount = gapData.gaps?.length ?? 0;
  const recommendedAngle = gapData.recommended_unique_angle || "Not specified";
  const serpSummary = gapData.serp_analysis_summary || "Not available";

  const userMessage = `Estimate traffic potential for this keyword cluster:

Seed Keyword: "${keywordData.seed}"
Primary Intent: ${keywordData.primary_intent}
Total Keywords in Cluster: ${keywordData.total_keywords}
All Keywords: ${keywordData.all_keywords.join(", ")}

Competition Context (from SERP gap analysis):
- Saturated angles: ${saturatedAngles}
- Number of gaps found: ${gapsCount}
- Recommended angle: ${recommendedAngle}
- Competition level hints: ${serpSummary}`;

  const result = await callLLM(SYSTEM_PROMPT, userMessage, { json: true });
  return result as TrafficProjection;
}

export { projectTraffic };
export type { TrafficProjection, KeywordAnalysis, SerpGapData };