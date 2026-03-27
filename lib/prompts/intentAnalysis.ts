import { callLLM } from "../llm";

const SYSTEM_PROMPT = `You are an expert SEO keyword strategist with 10+ years of experience in organic search optimization.

Given a seed keyword, you must:
1. Determine the PRIMARY search intent (one of: informational, commercial_investigation, transactional, navigational) with clear reasoning
2. Generate 15-20 related keywords including:
   - LSI (Latent Semantic Indexing) keywords
   - Long-tail variants (3-5 word phrases)
   - Question-form queries (who/what/why/how/when/where)
   - Comparison queries (X vs Y, best X for Y)
   - Local/regional variants if applicable
3. Group keywords into 4-6 semantic clusters by topic similarity
4. For each keyword, classify its intent type

Return ONLY valid JSON in this exact structure:
{
  "seed": "the original keyword",
  "primary_intent": "commercial_investigation",
  "intent_reasoning": "Clear explanation of why this intent was chosen",
  "keyword_clusters": {
    "cluster_name_1": [
      { "keyword": "example keyword", "type": "long-tail", "intent": "commercial" }
    ],
    "cluster_name_2": [...]
  },
  "all_keywords": ["flat list of all keyword strings"],
  "total_keywords": 18
}`;

/**
 * Stage 2: Analyze search intent and expand seed into keyword cluster
 * @param {string} seedKeyword - The seed keyword from user
 * @returns {Promise<object>} - Structured keyword analysis JSON
 */
async function analyzeIntent(seedKeyword: any) {
  const userMessage = `Analyze this seed keyword and generate a comprehensive keyword cluster:\n\nSeed Keyword: "${seedKeyword}"`;

  const result = await callLLM(SYSTEM_PROMPT, userMessage, { json: true });
  return result;
}

export { analyzeIntent };
