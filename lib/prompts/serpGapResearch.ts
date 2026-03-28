import { callLLM } from "../llm";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface KeywordClusterItem {
  keyword: string;
  type: string;
  intent: string;
}

interface KeywordAnalysis {
  seed: string;
  primary_intent: string;
  intent_reasoning: string;
  keyword_clusters: Record<string, KeywordClusterItem[]>;
  all_keywords: string[];
  total_keywords: number;
}

interface ContentGap {
  gap: string;
  opportunity: string;
  priority: "high" | "medium" | "low";
  estimated_impact: string;
}

interface SerpGapData {
  serp_analysis_summary: string;
  gaps: ContentGap[];
  saturated_angles: string[];
  outdated_info: string[];
  missing_perspectives: string[];
  format_gaps: string[];
  recommended_unique_angle: string;
  content_strategy: string;
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior SEO competitive analyst with deep expertise in 
SERP analysis, content gap identification, and ranking strategy.

You will receive a keyword cluster with intent analysis. Simulate analyzing the top 10 
Google results for the primary keyword as if you have actually reviewed them.

Think like this: "If I searched this keyword right now, what would the top results look 
like? What would they all cover? What would they ALL miss? What format would most of them 
use? What perspective would none of them have?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR ANALYSIS TASKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. SERP LANDSCAPE SUMMARY
   Describe what the typical top 10 results look like for this keyword:
   - What content format dominates? (listicles, how-tos, comparisons, landing pages)
   - What domain types rank? (blogs, SaaS sites, news, forums)
   - What is the average content depth? (shallow 500-word posts vs deep guides)
   - What is the general tone? (technical, beginner-friendly, sales-heavy)

2. CONTENT GAPS (most important — be SPECIFIC, not generic)
   Identify questions the top results FAIL to answer adequately.
   
   BAD gap (too generic — do NOT do this):
   ❌ "More detailed information needed"
   ❌ "Lacks practical examples"
   ❌ "Could be more comprehensive"
   
   GOOD gap (specific and actionable — do THIS):
   ✅ "No article explains the difference between blog automation for SaaS vs e-commerce 
      businesses — the workflows are completely different but all guides treat them the same"
   ✅ "Top results don't address what happens when AI-generated content gets flagged by 
      Google's helpful content update — a major fear for anyone considering automation"
   ✅ "No comparison of actual costs: human writer ($50-200/article) vs AI tools ($0.50-5) 
      vs hybrid approach — readers need this to make a decision"

   For each gap assign priority:
   - HIGH: Directly affects ranking decision, high search intent match
   - MEDIUM: Adds value but not the main differentiator  
   - LOW: Nice to have, unlikely to move rankings alone

3. SATURATED ANGLES
   What approaches are overdone and will NOT help a new article rank?
   These are the angles every competitor already covers well.
   Be specific — name the actual angle, not just "basic information".

4. OUTDATED INFORMATION
   What topics in this space have changed since 2023 that existing articles 
   likely get wrong or miss entirely?
   Think: algorithm updates, new tools, changed best practices, new research.

5. MISSING PERSPECTIVES
   What audiences or viewpoints are completely ignored by existing content?
   Examples: India-specific context, small business budget constraints, 
   non-technical founders, specific industries (healthcare, legal, e-commerce).

6. FORMAT GAPS
   What content formats would stand out because nobody uses them for this topic?
   Examples: interactive calculators, comparison tables with real pricing, 
   decision flowcharts, case studies with actual metrics, video walkthroughs,
   downloadable templates, before/after examples.

7. RECOMMENDED UNIQUE ANGLE
   Synthesize the highest-priority gaps into ONE clear winning angle.
   This should be specific enough that a writer knows exactly what makes 
   this article different from everything else that ranks.
   
   Format: "[Target audience] + [specific problem] + [unique solution/perspective]"
   Example: "For Indian SaaS startups who want to rank on Google without hiring 
   a content team — a cost-by-cost breakdown of AI blog automation with real 
   ROI numbers and Google-safe implementation steps"

8. CONTENT STRATEGY
   How should the blog be structured to exploit these gaps?
   Which gaps should be addressed first (highest in the article)?
   What format elements should be included?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Be specific and actionable — vague gaps are useless
- Prioritize gaps that match the primary search intent
- Consider the Indian market context if keywords suggest it
- Think about what would make a reader choose THIS article over the top result
- Minimum 5 gaps, maximum 10 — quality over quantity
- Every gap must have a clear "opportunity" (what to write to fill it)

Return ONLY valid JSON in this exact structure:
{
  "serp_analysis_summary": "2-3 sentence description of what typical top 10 results look like for this keyword — format, depth, tone, domain types",
  "gaps": [
    {
      "gap": "Specific, detailed description of what top results miss",
      "opportunity": "Exactly what content to write to fill this gap",
      "priority": "high",
      "estimated_impact": "Why this gap matters for ranking and reader conversion"
    }
  ],
  "saturated_angles": [
    "Specific angle that every competitor covers — avoid this"
  ],
  "outdated_info": [
    "Specific topic that has changed since 2023 that existing articles get wrong"
  ],
  "missing_perspectives": [
    "Specific audience or viewpoint that no existing article addresses"
  ],
  "format_gaps": [
    "Specific content format that would stand out because no competitor uses it"
  ],
  "recommended_unique_angle": "Single best angle: [audience] + [specific problem] + [unique solution]",
  "content_strategy": "2-3 sentence strategy on how to structure the blog, which gaps to address first, and what format elements to include"
}`;

// ─── Main Function ─────────────────────────────────────────────────────────────

/**
 * Stage 3: Simulate SERP analysis and find content gaps
 * @param keywordData - Output from intentAnalysis
 * @returns Structured SERP gap analysis JSON
 */
async function findSerpGaps(keywordData: KeywordAnalysis): Promise<SerpGapData> {

  const allKeywords = keywordData.all_keywords?.join(", ") || "No keywords provided";
  const clusters = JSON.stringify(keywordData.keyword_clusters || {}, null, 2);

  const userMessage = `Analyze the SERP landscape for this keyword cluster and find 
specific, actionable content gaps:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEYWORD DATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Seed Keyword: "${keywordData.seed}"
Primary Intent: ${keywordData.primary_intent}
Intent Reasoning: ${keywordData.intent_reasoning}

Full Keyword Cluster:
${clusters}

All Keywords: ${allKeywords}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANALYSIS INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Think about what someone searching "${keywordData.seed}" actually wants to know
2. Simulate what the top 10 Google results look like for this keyword
3. Identify the most specific, high-impact gaps — not generic ones
4. Consider the Indian market context if the keyword suggests it
5. The recommended unique angle must be specific enough to brief a writer immediately`;

  const result = await callLLM(SYSTEM_PROMPT, userMessage, { json: true });
  return result as SerpGapData;
}

export { findSerpGaps };
export type { SerpGapData, KeywordAnalysis, ContentGap };