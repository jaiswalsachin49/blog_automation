import { callLLM } from "../llm";
import type { BlogBrief } from "./generateBrief";
import type { SEOScorecard } from "./seoScore";

const SYSTEM_PROMPT = `You are a world-class SEO editor and content enhancer. 
Your task is to take an existing blog draft, original brief, and an SEO scorecard containing critical failures and recommended improvements. 
You must surgically rewrite and enhance the blog draft specifically to address these failed metrics, while maintaining the natural tone, overall structure, and target word count.

CRITICAL INSTRUCTIONS:
1. Fix all "critical_failures" and implement the "improvements" detailed in the scorecard.
2. IF KEYWORD DENSITY FAILED (>1.8%): Remove overused keywords. For the entire article, the keyword should appear NO MORE THAN 6-8 TIMES total. Use pronouns and synonyms instead.
3. IF WORD COUNT FAILED: Do NOT summarize. You MUST EXPAND the blog. Add detailed examples, new paragraphs, and deeper explanations to every H2 section. Ensure the blog is over 2000 words.
4. IF INTERNAL LINKS FAILED: Inject exactly 4 internal links as [anchor text](/).
5. Do NOT change the core meaning or rewrite parts of the blog that are already strong or pass the metrics.
6. Return ONLY the full, enhanced Markdown blog. Do NOT include ANY conversational text before or after (like "Here is the improved draft" or "Fixed by..."). Start immediately with the <!-- meta: --> tag.`;

export async function enhanceBlog(
  currentBlog: string,
  scorecard: SEOScorecard,
  brief: BlogBrief
): Promise<string> {
  const primaryKeyword = brief.primary_keywords?.[0] || "Target Keyword";
  
  const userMessage = `Please enhance the following blog post to fix its SEO issues.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEO SCORECARD FEEDBACK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Overall Score: ${scorecard.overall_score}

CRITICAL FAILURES TO FIX:
${scorecard.critical_failures.length > 0 ? scorecard.critical_failures.map((cf: string) => `- ${cf}`).join('\n') : "None explicitly listed as critical metrics."}

RECOMMENDED IMPROVEMENTS:
${scorecard.improvements.length > 0 ? scorecard.improvements.map((i: string) => `- ${i}`).join('\n') : "None explicitly listed."}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ORIGINAL BRIEF CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Title: ${brief.title}
Target Keyword: ${primaryKeyword}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CURRENT BLOG DRAFT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${currentBlog}

Remember, return the strictly improved Markdown blog and NOTHING ELSE! NO PREFIXES, NO SUFFIXES, NO EXPLANATIONS.`;

  const result = (await callLLM(SYSTEM_PROMPT, userMessage, { json: false })) as string;
  
  // Try to clean up if the LLM still output conversational filler
  let cleanResult = result.trim();
  const metaMatch = cleanResult.match(/<!--\s*meta:/i);
  if (metaMatch && metaMatch.index && metaMatch.index > 0) {
    cleanResult = cleanResult.substring(metaMatch.index);
  }
  
  // Cut off bottom notes
  const noteMatch = cleanResult.match(/(?:Note:|Here are the changes:|Summary:|Enhanced Blog Draft|SEO Scorecard)/i);
  if (noteMatch && noteMatch.index && noteMatch.index > cleanResult.length * 0.8) {
     cleanResult = cleanResult.substring(0, noteMatch.index).trim();
  }

  return cleanResult;
}
