import { callLLM } from "../llm";

const SYSTEM_PROMPT = `You are a world-class SEO content writer. You write long, detailed, high-ranking blog posts.

OUTPUT FORMAT — YOU MUST FOLLOW THIS EXACT STRUCTURE:

1. FIRST LINE must be a meta description HTML comment:
   <!-- meta: Your 150-160 character meta description with the primary keyword in the first 60 characters -->

2. SECOND LINE must be the H1 title (# Title)

3. THIRD element must be the intro paragraph:
   - Exactly 40-60 words
   - Must directly answer the topic like a dictionary definition
   - Must contain the primary keyword
   - Must NOT start with "I", "We", or "In today's"

4. BODY SECTIONS:
   - Use ## for H2 headings, ### for H3 sub-headings
   - Minimum 5 H2 sections (not counting FAQ and Conclusion)
   - Each H2 section must be 300+ words with examples and explanations
   - At least 2 H2 headings must contain the primary keyword
   - Include at least one "> Pro Tip:" blockquote in 2 different sections
   - Include at least one comparison table using Markdown table syntax

5. INTERNAL LINKS:
   - You MUST include at least 4 internal links using Markdown format: [anchor text](/)
   - Spread them across different sections, NOT clustered together
   - Use descriptive anchor text (NOT "click here" or "read more")

6. FAQ SECTION:
   - Must have a ## heading like "## Frequently Asked Questions" or "## FAQ"
   - Must contain exactly 4-6 questions using ### for each question
   - Each answer must be 40-60 words (concise, schema-friendly)

7. CONCLUSION:
   - Must contain the primary keyword
   - Must end with a clear Call-to-Action

KEYWORD RULES (CRITICAL FOR YOUR SCORE):
- Primary keyword MUST appear in: first 100 words, at least 2 H2 headings, conclusion, and the meta description
- MAXIMUM REPETITION: Do NOT use the primary keyword more than 6-8 times in the entire article. We strictly penalize over-optimization (>1.8% density).
- Let the keyword breathe. Rely entirely on VARIATIONS and SYNONYMS for the rest of the article.
- NEVER use: "delve", "leverage", "crucial", "vital", "robust", "transformative", "cutting-edge", "game-changer"
- NEVER start with: "In today's world", "It is important to note", "As we all know"

WORD COUNT & STRUCTURE (CRITICAL FOR LENGTH):
To hit the 2000+ word requirement, you MUST structure every single H2 section as follows:
1. An introduction paragraph (50+ words)
2. Detailed explanation/body paragraphs (200+ words)
3. A specific, detailed example or hypothetical scenario (100+ words)
4. A bulleted list of actionable takeaways (100+ words)
Do not be brief. Expand every point deeply. You will be penalized if the article is under 2000 words.`;

/**
 * Stage 6: Generate full SEO blog from brief
 */
async function writeBlog(brief: any, keywordData: any): Promise<string> {
  const primaryKeyword = brief.primary_keywords?.[0] || keywordData.all_keywords?.[0] || "target keyword";
  
  const userMessage = `Write a complete, publish-ready blog post using this brief.

CRITICAL REQUIREMENTS (YOUR OUTPUT WILL BE SCORED ON THESE):
1. Start with <!-- meta: [150-160 characters, keyword in first 60 chars] -->
2. Write AT LEAST ${brief.target_word_count || 2000} words. YOU MUST write 4-5 paragraphs per H2 section to hit this target.
3. Keep "${primaryKeyword}" usage to a MAXIMUM of 6-8 mentions total. DO NOT repeat the exact keyword constantly.
4. Include EXACTLY 4 internal links as [descriptive anchor text](/). You will fail if you include less than 4.
5. Include FAQ section with EXACTLY 4-6 questions, each answer 40-60 words
6. Put "${primaryKeyword}" in first 100 words, 2+ H2 headings, conclusion, and meta description
7. Meta description must be EXACTLY 150-160 characters (not more, not less)
8. Make FAQ questions conversational and voice-search friendly (start with How, What, Why, Can)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BLOG BRIEF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TITLE: ${brief.title}
META DESCRIPTION: ${brief.meta_description}
TARGET WORD COUNT: ${brief.target_word_count} words (MINIMUM — do not write less!)
UNIQUE ANGLE: ${brief.unique_angle}
TONE: ${brief.tone}
TARGET AUDIENCE: ${brief.target_audience}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEYWORD STRATEGY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRIMARY KEYWORD: ${primaryKeyword}
ALL PRIMARY KEYWORDS: ${brief.primary_keywords.join(", ")}
SECONDARY KEYWORDS: ${brief.secondary_keywords.join(", ")}
FEATURED SNIPPET STRATEGY: ${brief.featured_snippet_strategy}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FULL OUTLINE — FOLLOW THIS EXACTLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${brief.outline.map((section: any, index: number) => `
SECTION ${index + 1}: ${section.heading}
Target words for this section: ${section.estimated_words}
Content to cover:
${section.content_points.map((point: string) => `  - ${point}`).join("\n")}
Keywords to include: ${section.keywords_to_include.join(", ")}
`).join("\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FAQ SECTION — MUST INCLUDE (4-6 QUESTIONS MINIMUM)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${brief.faq_section.map((faq: any, i: number) => `
Q${i + 1}: ${faq.question}
Answer guidance: ${faq.answer_guidance}
Answer must be 40-60 words, concise and direct.
`).join("\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CTA INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Action: ${brief.cta.primary_action}
Placement: ${brief.cta.placement}
CTA text to use: "${brief.cta.cta_text}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTERNAL LINKS — YOU MUST EMBED ALL OF THESE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Embed each link in a natural sentence using Markdown: [Anchor Text](/)

${brief.internal_links.map((link: any) => `
- LINK: [${link.anchor_text}](/)
  Where to place it: ${link.context}
`).join("\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALL KEYWORDS TO USE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${keywordData.all_keywords.join(", ")}

Now write the complete blog post in Markdown. Start with the <!-- meta: --> comment on the very first line.`;

  const result = await callLLM(SYSTEM_PROMPT, userMessage, { json: false });
  return result as string;
}

export { writeBlog };