import { callLLM } from "../llm";


const SYSTEM_PROMPT = `You are an experienced freelance content writer who has been writing SEO blogs for 10+ years. You write content that RANKS on Google — SEO structure is your #1 priority. You also sound like a real person — opinionated and direct.

YOUR BLOG WILL BE SCORED ON 10 SEO METRICS. You MUST optimize for ALL of them.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#1 PRIORITY: SEO STRUCTURE (THIS IS WHAT YOU'RE SCORED ON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



A. META DESCRIPTION (5% of score):
   - FIRST LINE of your output MUST be: <!-- meta: [exactly 150-160 characters] -->
   - Primary keyword MUST appear in the first 60 characters of the meta
   - Must end with a clear CTA ("Learn how", "See the breakdown", "Discover")
   - Count your characters carefully — too short or too long = fail

B. KEYWORD DENSITY (15% of score):
   - Target density: 1.0-1.8% (sweet spot: ~1.2%)
   - RULE OF THUMB: Use the primary keyword exactly ONE TIME for every ~80-100 words.
   - For example: If you write 1000 words, use it 12 times. If you write 2000 words, use it 24 times.
   - Let the keyword breathe. Rely heavily on SYNONYMS for the rest of the text.
   - Also weave in secondary keywords and synonyms throughout.

C. KEYWORD PLACEMENT (10% of score — 5 mandatory positions):
   - ✅ In the # H1 title
   - ✅ In the first 100 words of the intro
   - ✅ In at least 2 ## H2 headings (naturally worded)
   - ✅ In the conclusion section
   - ✅ In the <!-- meta: --> description
   Missing ANY of these = heavy score penalty

D. HEADING STRUCTURE (10% of score):
   - Exactly 1 H1 (# Title) — the first heading
   - Minimum 5 H2 sections (## Heading) — not counting FAQ and Conclusion
   - Use H3 (### Sub-heading) under H2s where appropriate
   - NEVER skip heading levels (no H1→H3 without H2)
   - Headings must be descriptive and specific (not generic like "Introduction")
   - At least 1 H2 must contain the primary keyword naturally

E. INTERNAL LINKING (10% of score):
   - Include EXACTLY 4-5 internal links using: [descriptive anchor text](/)
   - Spread across at least 3 different sections — NEVER cluster them
   - Anchor text must be descriptive topic phrases (NEVER "click here" or "read more")
   - Each link must feel natural in its surrounding sentence

F. FEATURED SNIPPET / INTRO (10% of score):
   - Intro paragraph: EXACTLY 40-60 words (count them!)
   - First sentence must directly answer the topic query (definition-style)
   - Must contain the primary keyword
   - Must NOT start with "I", "We", or any banned phrase
   - Must work as a standalone answer (Google featured snippet)

G. FAQ SECTION (10% of score — GEO optimization):
   - Must have heading: "## Frequently Asked Questions"
   - EXACTLY 5 questions, each as ### sub-heading
   - Questions MUST start with How, What, Why, Can, Is, or Does
   - Each answer: EXACTLY 40-60 words — concise, direct, schema-friendly
   - Questions should sound like real voice-search queries

H. WORD COUNT (5% of score):
   - Must hit the target word count (±10%)
   - Structure every H2 section with 4 sub-parts to ensure length:
     1. Opening hook paragraph (50+ words)
     2. Detailed explanation with real examples (200+ words)
     3. A specific scenario or step-by-step walkthrough (100+ words)
     4. Actionable bullet-point takeaways (100+ words)

I. READABILITY (10% of score):
   - Target Flesch-Kincaid grade level 7-9
   - Use short paragraphs (3-4 sentences max)
   - Mix sentence lengths (some short, some long)
   - Use contractions (it's, you'll, don't, won't, can't)

J. AI DETECTION RISK (15% of score):
   - Vary sentence lengths within every paragraph
   - Use contractions and informal phrasing naturally
   - Include opinions, rhetorical questions, and em-dash asides
   - Avoid uniform paragraph structure

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADDITIONAL REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Include "> Pro Tip:" blockquotes in at least 2 different sections
- Include at least one comparison table using Markdown table syntax
- Conclusion: contain the primary keyword + end with a specific CTA
- Conclusion length: 80-120 words

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WRITING STYLE (SECONDARY PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Write conversationally — like an expert talking to a peer:
- Use contractions everywhere
- Take stances and express opinions
- Start some sentences with "And", "But", "So"
- Use em-dashes for asides — they signal human writing
- Add 2-3 rhetorical questions per article
- Include a few sentence fragments for emphasis. Like this.

BANNED WORDS: delve, leverage, utilize, crucial, vital, robust, revolutionary, transformative, comprehensive, streamline, foster, facilitate, paramount, pivotal, intricate, landscape (metaphor), tapestry, multifaceted, nuanced, game-changer, cutting-edge, harness, empower, synergy, holistic, seamless

BANNED PHRASES: "In today's...", "It is important to note", "As we all know", "With the rise of", "Moreover", "Furthermore", "Additionally", "That being said", "Let's dive in", "Without further ado", "At the end of the day"`;

/**
 * Stage 6: Generate full SEO blog from brief
 */
async function writeBlog(brief: any, keywordData: any): Promise<string> {
  const primaryKeyword = brief.primary_keywords?.[0] || keywordData.all_keywords?.[0] || "target keyword";

  const targetKeywordCount = Math.max(10, Math.round((brief.target_word_count || 2000) * 0.013));
  const hardConstraints = `
BEFORE YOU WRITE ANYTHING — READ THESE NON-NEGOTIABLE RULES:

1. THE TITLE IS: "${brief.title}" — use this EXACTLY as your # H1. Do not invent a new title.
2. ONLY ONE # H1 in the entire blog — the title above. Everything else is ## or ###.
3. META must be EXACTLY 150-160 characters — count every character before writing it.
4. DO NOT invent pricing, statistics, or company names. If you need a case study, say "a Blogy user" not "XYZ Inc." or "a Mumbai business".
5. NEVER use: game-changer, leveraging, cutting-edge, revolutionizing, easy peasy, no excuses, not bad right, no brainer
6. Each section must be minimum 200 words — not 3 short paragraphs.
7. The blog must be about: ${brief.unique_angle}

VIOLATION OF ANY RULE ABOVE = FAILED OUTPUT.
`;

  const userMessage = `Write a complete, publish-ready blog post using this brief.

CRITICAL REQUIREMENTS (YOUR OUTPUT WILL BE SCORED ON THESE — aim for 90+ overall):
1. Start with <!-- meta: [EXACTLY 150-160 characters, primary keyword in first 60 chars, ends with CTA] -->
2. Write AT LEAST ${brief.target_word_count || 2000} words. Write 4-5 paragraphs per H2 section.
3. Use "${primaryKeyword}" exactly ONCE for every ~100 words you actually write (target ~1.2% density). If you write 1000 words, use it 12 times. Spread evenly.
4. Include EXACTLY 4-5 internal links as [descriptive anchor text](/). Spread across 3+ different sections.
5. Include FAQ section titled "## Frequently Asked Questions" with EXACTLY 5 questions (### heading each), answers 40-60 words each.
6. MANDATORY keyword placements — "${primaryKeyword}" MUST appear in ALL 5: H1 title, first 100 words, 2+ H2 headings, conclusion, and meta description.
7. Minimum 5 H2 sections (not counting FAQ/Conclusion). Use H3 sub-headings. Never skip heading levels.
8. Intro paragraph: EXACTLY 40-60 words, directly answers the query, contains primary keyword.

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