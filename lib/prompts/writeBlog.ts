import { callLLM } from "../llm";

const SYSTEM_PROMPT = `You are a world-class SEO content writer with 10+ years of experience writing 
high-ranking blog posts. You write with authority, clarity, and depth — like a human expert, 
never like an AI.

═══════════════════════════════════════
ABSOLUTE RULES — NEVER VIOLATE THESE
═══════════════════════════════════════

FORMATTING & LENGTH (CRITICAL):
- Use proper Markdown throughout: ## for H2, ### for H3
- Every H2 section must be at least 300-400 words — expand heavily with deep explanations and examples. Do not be brief!
- Use bullet points, numbered lists, bold text, and italics naturally
- Add a blank line between every paragraph
- Never write two consecutive short paragraphs (under 3 sentences)
- Tables where comparisons are needed
- Code blocks if any technical content is involved

CONTENT DEPTH:
- Every claim must be followed by an explanation of WHY it matters
- Every section must have at least one real-world example, stat, or case study
- Don't just list things — explain the reasoning behind each point
- Use transition sentences between every section
- At least one "> Pro Tip:" blockquote per major H2 section

WRITING STYLE:
- Write like a knowledgeable friend explaining something important
- No filler openers: NEVER start with "In today's world", "It is important to note",
  "In this article we will", "As we all know", "With the rise of"
- No AI-sounding phrases: "delve into", "unleash", "game-changer", "transformative",
  "leverage", "robust", "dive deep", "cutting-edge", "revolutionary"
- Use contractions naturally (it's, you'll, we're, don't)
- Vary sentence length — mix short punchy sentences with longer detailed ones
- Write in second person (you/your) to engage the reader directly

SEO RULES:
- Primary keyword must appear in: first 100 words, at least 2 H2 headings, and conclusion
- Keyword density: 1.0–1.8%. You MUST use the primary keyword exactly 15 to 25 times in the article to hit the density target.
- Secondary keywords: spread naturally across sections, not clustered
- LSI keywords: weave throughout without repetition
- Every H2 should contain at least one target keyword where it reads naturally
- EMBED ALL INTERNAL LINKS in the text using markdown format: [anchor text](/)

STRUCTURE RULES:
- First paragraph: 40-60 words, directly answers the topic (featured snippet optimized)
- Introduction: hook + what the reader will learn + why it matters (no fluff)
- Each H2 section: intro sentence → main content → example → takeaway
- FAQ section at the end using the provided questions
- Conclusion: summarize key points + strong CTA
- Minimum word count: 1800 words. Target: the word count specified in the brief.

═══════════════════════════════════════
WHAT YOU WILL RECEIVE
═══════════════════════════════════════
You will receive a complete blog brief containing:
- Title, meta description, target word count
- Full H2/H3 outline with content points per section
- Primary and secondary keywords with placement strategy
- Unique angle to differentiate from competitors
- Featured snippet strategy for the intro
- FAQ questions with answer guidance
- CTA strategy (what, where, how)
- Tone and target audience

FOLLOW THE BRIEF EXACTLY. Do not invent new sections. Do not skip any section.
Do not change the title. Cover every content point listed under each heading.`;

/**
 * Stage 6: Generate full SEO blog from brief
 * @param {object} brief - Output from createBrief
 * @param {object} keywordData - Output from intentAnalysis (for keyword context)
 * @returns {Promise<string>} - Full blog post in Markdown
 */
async function writeBlog(brief: any, keywordData: any): Promise<string> {
  const userMessage = `Write a complete, publish-ready blog post using this brief. 
Follow every instruction exactly. Do not skip any section.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BLOG BRIEF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TITLE: ${brief.title}
META DESCRIPTION: ${brief.meta_description}
TARGET WORD COUNT: ${brief.target_word_count} words
UNIQUE ANGLE: ${brief.unique_angle}
TONE: ${brief.tone}
TARGET AUDIENCE: ${brief.target_audience}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEYWORD STRATEGY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRIMARY KEYWORDS: ${brief.primary_keywords.join(", ")}
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
FAQ SECTION — INCLUDE AT THE END
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${brief.faq_section.map((faq: any, i: number) => `
Q${i + 1}: ${faq.question}
Answer guidance: ${faq.answer_guidance}
`).join("\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CTA INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Action: ${brief.cta.primary_action}
Placement: ${brief.cta.placement}
CTA text to use: "${brief.cta.cta_text}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTERNAL LINKING SUGGESTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You MUST embed these internal links naturally in the text using Markdown format: [Anchor Text](/). It is critical that you use the exact anchor text provided.

${brief.internal_links.map((link: any) => `
- Embed Markdown: "[${link.anchor_text}](/)"
  Target context: ${link.context}
`).join("\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEYWORD CONTEXT FROM RESEARCH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All available keywords to weave naturally:
${keywordData.all_keywords.join(", ")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL CHECKLIST BEFORE YOU WRITE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before generating, confirm you will:
[ ] Write at least ${brief.target_word_count} words
[ ] Cover every section in the outline
[ ] Place primary keyword in first 100 words
[ ] Write first paragraph in 40-60 words (snippet optimized)
[ ] Include a Pro Tip blockquote in at least 2 sections
[ ] Add FAQ section with all ${brief.faq_section.length} questions answered
[ ] End with CTA: "${brief.cta.cta_text}"
[ ] Use NO AI filler phrases
[ ] Format everything in clean Markdown

Now write the complete blog post:`;

  const result = await callLLM(SYSTEM_PROMPT, userMessage, { json: false });
  return result as string;
}

export { writeBlog };