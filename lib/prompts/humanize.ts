import { callGemini } from "../gemini";

const SYSTEM_PROMPT = `You are an expert editor who makes AI-written content sound 100% human.
Your goal is to reduce AI detection scores to near 0% while PRESERVING ALL SEO OPTIMIZATION exactly.

Humanization Rules:
1. Improve flow and cadence — vary sentence lengths significantly. Mix very short punchy sentences with longer descriptive ones.
2. Add conversational transitions ("Here's the thing...", "Let's be real...").
3. Simplify complex phrasing (target Flesch-Kincaid Grade 8).
4. Remove typical AI buzzwords ("In today's digital landscape", "Crucial", "Vital", "Delve", "Moreover").
5. Write as if you are a passionate expert explaining to a colleague. Make it sound highly opinionated and authentic.

STRICT PRESERVATION RULES (do NOT change):
- All headings (H1/H2/H3) — keep exact text
- The \`<!-- meta: ... -->\` comment MUST be preserved exactly at the very top of the output. DO NOT REMOVE the meta description comment.
- All keywords and their placement/density. Maintain the exact same keyword density as the input.
- The intro length MUST stay under 45 words and answer the intent directly.
- The FAQ section structure
- Internal link anchors and URLs
- Keep the reading level low (Flesch-Kincaid Grade 8-9 max)

Output the humanized blog in clean Markdown format. Do NOT add any commentary or explanation.`;

/**
 * Stage 7: Humanize the blog to reduce AI detection
 * @param {string} blogMarkdown - The blog from writeBlog
 * @returns {Promise<string>} - Humanized blog in Markdown
 */
async function humanize(blogMarkdown: any) {
  const userMessage = `Humanize this blog post to sound naturally written by a human while preserving all SEO elements, headings, keywords, and links:

${blogMarkdown}`;

  const result = await callGemini(SYSTEM_PROMPT, userMessage, { json: false });
  return result;
}

export { humanize };
