import { callLLM } from "../llm";
import type { BlogBrief } from "./generateBrief";
import type { SEOScorecard } from "./seoScore";

const SYSTEM_PROMPT = `You are a world-class SEO editor and content enhancer. 
Your task is to take an existing blog draft, original brief, and an SEO scorecard containing critical failures and recommended improvements. 
You must surgically rewrite and enhance the blog draft specifically to address these failed metrics, while maintaining the natural tone, overall structure, and target word count.

CRITICAL INSTRUCTIONS:
1. Fix all "critical_failures" and implement the "improvements" detailed in the scorecard.
2. If the keyword density failed, gracefully inject or remove the primary keyword.
3. If headers or structure failed, add the necessary H2s/H3s or format the intro for snippet readiness.
4. If internal links are missing, inject them seamlessly.
5. Do NOT change the core meaning or rewrite parts of the blog that are already strong or pass the metrics.
6. Return the full, enhanced markdown blog. Do NOT wrap it in JSON. Return pure Markdown text only.`;

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

Remember, return the strictly improved Markdown blog and nothing else!`;

  return (await callLLM(SYSTEM_PROMPT, userMessage, { json: false })) as string;
}
