import { callLLM } from "../llm";
import type { KeywordAnalysis, SerpGapData, ContentGap } from "./serpGapResearch";
import type { TrafficProjection } from "./trafficProjection";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface OutlineSection {
  heading: string;
  level: "h2" | "h3";
  content_points: string[];
  keywords_to_include: string[];
  estimated_words: number;
  writing_guidance: string;
}

interface InternalLink {
  anchor_text: string;
  context: string;
  target_topic: string;
}

interface FAQItem {
  question: string;
  answer_guidance: string;
}

interface CTAStrategy {
  primary_action: string;
  placement: string;
  cta_text: string;
}

interface KeywordPlacement {
  location: string;
  keyword: string;
  reason: string;
}

interface BlogBrief {
  title: string;
  meta_description: string;
  target_word_count: number;
  primary_keywords: string[];
  secondary_keywords: string[];
  unique_angle: string;
  featured_snippet_strategy: string;
  intro_structure: string;
  outline: OutlineSection[];
  keyword_placement: KeywordPlacement[];
  internal_links: InternalLink[];
  faq_section: FAQItem[];
  cta: CTAStrategy;
  tone: string;
  target_audience: string;
  writing_warnings: string[];
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior SEO content strategist who creates detailed, 
writer-ready blog briefs. Your briefs are so specific that a writer needs zero 
clarification — they just follow it and produce a ranking article.

This brief is the architectural blueprint. The blog writer will follow it EXACTLY.
Every vague instruction here becomes a vague section in the final blog.
So be specific, prescriptive, and detailed in every field.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT YOU WILL RECEIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Keyword research: seed, intent, full keyword clusters
- SERP gap analysis: what competitors miss, unique angle, content strategy
- Traffic projection: volume estimates, competition level, target audience context

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BRIEF CREATION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TITLE:
- Must contain the primary keyword naturally
- Must be compelling and specific — not generic
- Hard limit: 60 characters
- No clickbait — be accurate about what the article delivers
- BAD: "The Ultimate Guide to AI Blog Writing" (generic, overused format)
- GOOD: "AI Blog Automation for Startups: Cut Content Costs by 80%" (specific, benefit-led)

META DESCRIPTION:
- 150-160 characters exactly — count them
- Must include primary keyword in first half
- Must end with a clear CTA ("Learn how", "See the breakdown", "Start free")
- Must accurately describe the article — no bait and switch

OUTLINE RULES:
- 6-8 H2 sections minimum
- Each H2 must have 2-4 H3 subsections where the topic warrants depth
- Every section needs:
  * content_points: 3-5 specific bullets of WHAT to write (not vague like "explain X")
  * keywords_to_include: exact keywords from the cluster to weave in
  * estimated_words: realistic word budget for that section
  * writing_guidance: one sentence on HOW to write this section (tone, angle, format)
  
- Content points must be THIS specific:
  BAD: ❌ "Explain the benefits of AI blog writing"
  GOOD: ✅ "Compare cost per article: human writer ($50-200) vs AI tool ($0.50-5) vs 
            hybrid ($10-30) — use a 3-column table with real price ranges"
  
  BAD: ❌ "Talk about SEO optimization"  
  GOOD: ✅ "Explain exactly where to place the primary keyword: title, first 100 words, 
            one H2, and conclusion — give a real before/after example paragraph"

FEATURED SNIPPET STRATEGY:
- The intro paragraph must be 40-50 words maximum
- It must directly answer the main query in the first sentence
- Structure: [Direct answer] + [Why it matters] + [What this article covers]
- Write the exact intro structure the writer should follow — not just "keep it short"

KEYWORD PLACEMENT:
- List every single placement of primary keyword with exact location
- List top 5 secondary keywords with their target sections
- Specify keyword density target: 1.0-1.8% of total word count
- Flag any sections where keyword stuffing risk is high

INTERNAL LINKING:
- 3-5 links minimum
- Each link must specify: exact anchor text + which paragraph + why it's relevant
- If no real internal pages exist, suggest topic-based placeholders
- Anchor text must be descriptive — never "click here" or "read more"

FAQ SECTION:
- 5-7 questions minimum
- Questions must be actual search queries people type (question-form keywords)
- Each answer_guidance must be 2-3 specific points the writer should cover
- Structure for schema markup: short direct answer first, then elaboration

WRITING WARNINGS:
- List 3-5 specific things the writer must NOT do for this particular topic
- These are topic-specific pitfalls, not generic writing advice
- Example: "Do not claim specific ranking timelines — Google's algorithm is unpredictable"
- Example: "Do not recommend specific AI tools without mentioning their limitations"

TONE AND AUDIENCE:
- Tone must be specific: not just "professional" — describe the voice, style, 
  level of technicality, use of humor, formality level
- Target audience must be specific: not just "marketers" — describe their 
  experience level, pain points, what they've already tried, what they need

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- The unique angle from SERP gap analysis MUST be reflected in the title and intro
- High-priority gaps MUST appear in the first 3 sections of the outline
- The brief must be self-contained — a writer with no other context can follow it
- Word count target: 1800-2500 words (adjust based on competition level)
- If competition is HIGH: target 2200-2500 words for depth advantage
- If competition is LOW/MEDIUM: 1800-2000 words is sufficient

Return ONLY valid JSON in this exact structure:
{
  "title": "Exact SEO-optimized title under 60 characters",
  "meta_description": "150-160 char meta with keyword + CTA",
  "target_word_count": 2200,
  "primary_keywords": ["primary keyword", "close variant"],
  "secondary_keywords": ["kw1", "kw2", "kw3", "kw4", "kw5"],
  "unique_angle": "Specific differentiator from SERP gap analysis",
  "featured_snippet_strategy": "Exact structure for the intro paragraph",
  "intro_structure": "Sentence-by-sentence guide for writing the intro",
  "outline": [
    {
      "heading": "H2: Exact Section Heading",
      "level": "h2",
      "content_points": [
        "Specific point 1 with exactly what to write and how",
        "Specific point 2 with format suggestion (table/list/example)",
        "Specific point 3 with data or angle to use"
      ],
      "keywords_to_include": ["keyword1", "keyword2"],
      "estimated_words": 300,
      "writing_guidance": "One sentence on tone/format/angle for this section"
    }
  ],
  "keyword_placement": [
    {
      "location": "Title",
      "keyword": "primary keyword",
      "reason": "Required for title tag SEO"
    }
  ],
  "internal_links": [
    {
      "anchor_text": "descriptive anchor text",
      "context": "Which paragraph and why this link fits here",
      "target_topic": "Topic/page this should link to"
    }
  ],
  "faq_section": [
    {
      "question": "Exact question someone would type in Google",
      "answer_guidance": "3 specific points the answer must cover"
    }
  ],
  "cta": {
    "primary_action": "Specific action with context",
    "placement": "Exact location in the blog",
    "cta_text": "Exact CTA copy to use"
  },
  "tone": "Detailed description of voice, style, technicality, formality",
  "target_audience": "Specific description of reader: experience, pain points, goals",
  "writing_warnings": [
    "Specific thing to avoid for THIS topic with reason"
  ]
}`;

// ─── Main Function ─────────────────────────────────────────────────────────────

/**
 * Stage 5: Generate structured blog brief/blueprint
 * @param keywordData - Output from intentAnalysis
 * @param gapData - Output from serpGapResearch
 * @param trafficData - Output from trafficProjection
 * @returns Structured blog brief JSON
 */
async function createBrief(
  keywordData: KeywordAnalysis,
  gapData: SerpGapData,
  trafficData: TrafficProjection
): Promise<BlogBrief> {

  // Safe extractions with fallbacks
  const highPriorityGaps = gapData.gaps
    ?.filter((g: ContentGap) => g.priority === "high")
    ?.map((g: ContentGap) => `- ${g.gap} → ${g.opportunity}`)
    ?.join("\n") || "No high priority gaps identified";

  const mediumPriorityGaps = gapData.gaps
    ?.filter((g: ContentGap) => g.priority === "medium")
    ?.map((g: ContentGap) => `- ${g.gap}`)
    ?.join("\n") || "None";

  const formatGaps = gapData.format_gaps?.join("; ") || "None identified";
  const missingPerspectives = gapData.missing_perspectives?.join("; ") || "None identified";
  const saturatedAngles = gapData.saturated_angles?.join("; ") || "None identified";
  const outdatedInfo = gapData.outdated_info?.join("; ") || "None identified";
  const volumeLow = trafficData.primary_keyword_volume?.estimated_range?.low ?? 0;
  const volumeHigh = trafficData.primary_keyword_volume?.estimated_range?.high ?? 0;

  const userMessage = `Create a detailed, writer-ready blog brief for this content opportunity.
Every field must be specific enough that a writer needs zero clarification.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEYWORD RESEARCH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Seed Keyword: "${keywordData.seed}"
Primary Intent: ${keywordData.primary_intent}
Intent Reasoning: ${keywordData.intent_reasoning}

Keyword Clusters:
${JSON.stringify(keywordData.keyword_clusters, null, 2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SERP GAP ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SERP Landscape: ${gapData.serp_analysis_summary}

HIGH PRIORITY GAPS (must be covered in first 3 sections):
${highPriorityGaps}

MEDIUM PRIORITY GAPS (cover if word count allows):
${mediumPriorityGaps}

Saturated Angles to AVOID: ${saturatedAngles}
Outdated Info to UPDATE: ${outdatedInfo}
Missing Perspectives to ADD: ${missingPerspectives}
Format Gaps to EXPLOIT: ${formatGaps}

Recommended Unique Angle: ${gapData.recommended_unique_angle}
Content Strategy: ${gapData.content_strategy}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRAFFIC & COMPETITION CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Estimated Monthly Search Volume: ${volumeLow}–${volumeHigh}
Competition Level: ${trafficData.competition_level}
Competition Reasoning: ${trafficData.competition_reasoning}
Target Audience Context: ${trafficData.traffic_summary}
Monetization Potential: ${trafficData.monetization?.affiliate_potential} affiliate potential

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BRIEF REQUIREMENTS REMINDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Title must reflect the unique angle: "${gapData.recommended_unique_angle}"
- High-priority gaps must appear in the first 3 outline sections
- Content points must be specific with format suggestions (tables, examples, comparisons)
- Word count: ${trafficData.competition_level === "high" ? "2200-2500" : "1800-2000"} words
- Include writing_warnings specific to this topic
- FAQ questions must be real search queries people type`;

  // Brief generation has a massive system prompt + full data (~6K tokens).
  const result = await callLLM(SYSTEM_PROMPT, userMessage, { json: true });
  return result as BlogBrief;
}

export { createBrief };
export type { BlogBrief, OutlineSection, InternalLink, FAQItem };