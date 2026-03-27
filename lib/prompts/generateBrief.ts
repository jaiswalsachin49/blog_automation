import { callLLM } from "../llm";

const SYSTEM_PROMPT = `You are an expert SEO content strategist who creates detailed blog briefs (blueprints) before any content is written.

Given keyword research, SERP gap analysis, and traffic projections, create a comprehensive blog brief that a writer must follow exactly. This brief is the architectural blueprint — no writing happens without it.

The brief must include:
1. **SEO-optimized title** — Contains primary keyword, compelling, <60 characters
2. **Meta description** — 150-160 characters, includes primary keyword, has a CTA
3. **Content outline** — H2/H3 structure with 6-8 main sections, each with:
   - Heading text (keyword-optimized where natural)
   - 2-3 bullet points describing what to cover
   - Which keywords to incorporate in this section
4. **Target word count** — 1800-2500 words
5. **Keyword placement strategy** — Where exactly to place primary/secondary keywords
6. **Unique angle** — The differentiator from SERP gap analysis
7. **Featured snippet strategy** — How intro paragraph should be structured to win position 0
8. **Internal linking plan** — 3-5 suggested internal link anchors with context
9. **FAQ section** — 3-5 questions for schema markup / voice search
10. **CTA strategy** — What action readers should take, where to place it

Return ONLY valid JSON:
{
  "title": "SEO-optimized blog title",
  "meta_description": "150-160 char meta description with CTA",
  "target_word_count": 2200,
  "primary_keywords": ["keyword1", "keyword2"],
  "secondary_keywords": ["keyword3", "keyword4", "keyword5"],
  "unique_angle": "What makes this blog different",
  "featured_snippet_strategy": "How to structure intro for position 0",
  "outline": [
    {
      "heading": "H2: Section Title",
      "level": "h2",
      "content_points": ["Point 1 to cover", "Point 2 to cover"],
      "keywords_to_include": ["keyword1"],
      "estimated_words": 300
    }
  ],
  "internal_links": [
    {
      "anchor_text": "suggested anchor text",
      "context": "Where and why to place this link",
      "target_topic": "What page this should link to"
    }
  ],
  "faq_section": [
    {
      "question": "A common question about the topic?",
      "answer_guidance": "Key points the answer should cover"
    }
  ],
  "cta": {
    "primary_action": "What readers should do",
    "placement": "Where in the blog to place it",
    "cta_text": "Suggested CTA button/link text"
  },
  "tone": "Description of the writing tone to use",
  "target_audience": "Who this blog is written for"
}`;

/**
 * Stage 5: Generate structured blog brief/blueprint
 * @param {object} keywordData - Output from intentAnalysis
 * @param {object} gapData - Output from serpGapResearch
 * @param {object} trafficData - Output from trafficProjection
 * @returns {Promise<object>} - Structured blog brief JSON
 */
async function createBrief(keywordData: any, gapData: any, trafficData: any) {
  const userMessage = `Create a detailed blog brief for this content opportunity:

KEYWORD DATA:
- Seed: "${keywordData.seed}"
- Intent: ${keywordData.primary_intent} — ${keywordData.intent_reasoning}
- Keyword Clusters: ${JSON.stringify(keywordData.keyword_clusters, null, 2)}

SERP GAP ANALYSIS:
- Recommended Angle: ${gapData.recommended_unique_angle}
- High-Priority Gaps: ${gapData.gaps.filter((g: any) => g.priority === "high").map((g: any) => g.gap).join("; ")}
- Content Strategy: ${gapData.content_strategy}
- Format Gaps: ${gapData.format_gaps.join("; ")}

TRAFFIC PROJECTION:
- Estimated Monthly Volume: ${trafficData.primary_keyword_volume.estimated_range.low}-${trafficData.primary_keyword_volume.estimated_range.high}
- Competition: ${trafficData.competition_level}
- Target Audience Context: ${trafficData.traffic_summary}`;

  const result = await callLLM(SYSTEM_PROMPT, userMessage, { json: true });
  return result;
}

export { createBrief };
