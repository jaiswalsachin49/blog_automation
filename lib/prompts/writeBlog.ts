import { callGemini } from "../gemini";

const SYSTEM_PROMPT = `You are a professional SEO content writer who produces high-ranking blog posts.

You will receive a detailed blog brief (blueprint). You MUST follow it EXACTLY — the title, outline, keyword placement, word count, and structure are non-negotiable.

Writing rules & CRITICAL SEO CONSTRAINTS:
1. **Title**: Use the exact title from the brief.
2. **Snippet Readiness (CRITICAL)**: The VERY FIRST paragraph MUST answer the user intent directly in 40-45 words MAXIMUM. No fluff. Direct, punchy answer.
3. **Keyword Density**: The primary keyword MUST appear exactly enough times to hit around 1.5% density. Intentionally place it in headings, the first 50 words, and naturally in the body. Do not stuff it too much, but don't under-use it either. Target exactly 1-2%.
4. **Readability**: Write at a Flesch-Kincaid Grade Level 8 to 9. Use short sentences, simple vocabulary, and conversational tone. AVOID complex phrasing.
5. **Heading Structure**: Follow the brief's H2/H3 outline exactly. Never skip heading levels.
6. **Paragraphs & Formatting**: Keep to 3-4 sentences max. Bold key concepts. Use bulleted lists for comparisons or steps.
7. **FAQ Section**: Include the FAQ questions from the brief with concise, direct answers (2-3 sentences each). Format as:
   ### Q: Question here?
   Answer here.
8. **Internal Links**: Naturally weave in exact or partial match anchor text for the provided internal links.
9. **Word Count**: Hit the target ±10%.

Output the blog in clean Markdown format. Include a meta description comment at the top:
<!-- meta: Your meta description here -->

Do NOT include any explanation or commentary outside the blog itself.`;

/**
 * Stage 6: Generate the full blog post from the brief
 * @param {object} brief - Output from createBrief
 * @returns {Promise<string>} - Full blog in Markdown
 */
async function writeBlog(brief: any) {
  const userMessage = `Write a complete blog post following this brief EXACTLY:

TITLE: ${brief.title}
META DESCRIPTION: ${brief.meta_description}
TARGET WORD COUNT: ${brief.target_word_count}
TONE: ${brief.tone}
TARGET AUDIENCE: ${brief.target_audience}
UNIQUE ANGLE: ${brief.unique_angle}

PRIMARY KEYWORDS: ${brief.primary_keywords.join(", ")}
SECONDARY KEYWORDS: ${brief.secondary_keywords.join(", ")}

FEATURED SNIPPET STRATEGY: ${brief.featured_snippet_strategy}

OUTLINE:
${brief.outline.map((section: any, i: number) => `${i + 1}. ${section.heading} (~${section.estimated_words} words)
   Cover: ${section.content_points.join("; ")}
   Keywords to include: ${section.keywords_to_include.join(", ")}`).join("\n")}

INTERNAL LINKS TO INCLUDE:
${brief.internal_links.map((link: any) => `- Anchor: "${link.anchor_text}" → Context: ${link.context}`).join("\n")}

FAQ SECTION:
${brief.faq_section.map((faq: any) => `Q: ${faq.question}\nGuidance: ${faq.answer_guidance}`).join("\n\n")}

CTA:
- Action: ${brief.cta.primary_action}
- Placement: ${brief.cta.placement}
- Text: ${brief.cta.cta_text}

Now write the complete blog post in Markdown.`;

  const result = await callGemini(SYSTEM_PROMPT, userMessage, { json: false });
  return result;
}

export { writeBlog };
