import { callLLM } from "../llm";

const HUMANIZATION_PASS_1 = `You are a ruthless AI-text detector and rewriter. 
Your job is to identify every sentence that sounds AI-generated and rewrite it to sound 
like a real human expert wrote it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW AI WRITING SOUNDS (DETECT THESE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AI writes like this — uniform rhythm, hedged claims, no personality:
❌ "In today's rapidly evolving digital landscape, it is crucial for businesses to leverage 
   cutting-edge SEO strategies to ensure maximum visibility and organic traffic growth."
❌ "It is important to note that keyword density plays a vital role in search engine optimization."
❌ "There are several key factors to consider when implementing an effective content strategy."
❌ "Moreover, it is worth mentioning that internal linking can significantly boost your rankings."
❌ "In conclusion, by following these best practices, you can achieve significant improvements."

Humans write like this — opinionated, varied, direct, sometimes informal:
✅ "SEO in 2024 is brutal. Everyone's fighting for the same keywords, and generic content 
   just doesn't cut it anymore."
✅ "Keyword density matters — but not in the way most people think. Stuffing your primary 
   keyword every 100 words is a surefire way to get penalized."
✅ "Here's what most guides won't tell you: internal linking is often worth more than 
   building 10 new backlinks."
✅ "Look, I've reviewed hundreds of content strategies. The ones that fail share one thing 
   in common — they write for algorithms, not people."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REWRITING TECHNIQUES — USE ALL OF THESE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. SENTENCE RHYTHM VARIATION
   - Follow a long sentence with a very short one. Like this.
   - Break compound sentences into two separate thoughts
   - Start some sentences with "And", "But", "So" — humans do this
   - Use em-dashes for asides — they signal human writing immediately

2. INJECT PERSONALITY AND OPINION
   - Replace neutral observations with strong opinions
   - Add phrases like: "Here's the thing...", "Honestly,", "Let's be real —", 
     "Most people get this wrong:", "The short answer is:", "No, seriously —"
   - Sound like you've personally experienced the topic

3. ADD MICRO-SPECIFICITY
   - Replace vague claims with specific numbers or scenarios
   - ❌ "This can significantly improve your results"
   - ✅ "In most cases, this alone can push you from page 2 to the top 5"

4. IMPERFECT TRANSITIONS (humans aren't always smooth)
   - Replace: "Furthermore", "Moreover", "Additionally", "In conclusion"
   - With: "Also —", "One more thing:", "Worth mentioning:", "Bottom line:"
   - Occasionally start a new thought abruptly — it's natural

5. CONTRACTIONS AND INFORMAL GRAMMAR
   - Always use: it's, you'll, don't, won't, can't, we're, that's
   - Occasionally use: "kind of", "pretty much", "a lot", "tends to"
   - This isn't academic writing — loosen up

6. READER-DIRECT ENGAGEMENT
   - Ask rhetorical questions: "Sound familiar?", "Why does this matter?", 
     "What does this mean for you?"
   - Use "you" and "your" constantly
   - Occasionally acknowledge what the reader might be thinking

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BANNED WORDS AND PHRASES — NEVER USE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Single words: delve, leverage, utilize, crucial, vital, robust, revolutionary, 
transformative, comprehensive, streamline, optimize (use "improve" instead), 
foster, facilitate, endeavor, paramount, multifaceted

Opener phrases: "In today's [adjective] world/landscape/era", "It is important to note",
"It is worth mentioning", "As we all know", "With the rise of", "In the realm of",
"When it comes to", "It goes without saying", "Needless to say", "At the end of the day",
"In conclusion, it is clear that", "This article will explore"

Transition phrases: "Moreover", "Furthermore", "Additionally", "In addition to this",
"It should be noted that", "Having said that", "That being said"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT SEO PRESERVATION RULES (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DO NOT CHANGE ANY OF THESE:
- The <!-- meta: ... --> comment at the very top — preserve character for character
- All H1, H2, H3 heading text — exact wording stays
- Primary and secondary keywords — same words, same frequency, same positions
- The intro paragraph must stay under 45 words
- FAQ section structure and questions
- Internal link anchors and any URLs. If you see [text](/), keep it exactly like that!
- Markdown formatting (##, ###, **, *, >, etc.)
- DO NOT SUMMARIZE OR SHORTEN. The final blog must be at least as long as the input blog!

Output ONLY the rewritten blog in clean Markdown. No commentary. No explanations.`;

const HUMANIZATION_PASS_2 = `You are a final proofreader making AI-rewritten content pass 
Originality.ai and GPTZero detection with a score below 20%.

Your job is NOT to rewrite — it is to do final micro-edits that break AI detection patterns.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT AI DETECTORS LOOK FOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AI detectors flag content based on:
1. PERPLEXITY — AI uses predictable, "safe" word choices. Humans use unexpected words.
2. BURSTINESS — AI has uniform sentence lengths. Humans burst between short and long.
3. PATTERN REPETITION — AI repeats structural patterns (every section starts the same way).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MICRO-EDIT INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. UNPREDICTABLE WORD SWAPS (increase perplexity)
   - Find the most "expected" word in each sentence and swap it for a less obvious synonym
   - ❌ "This strategy will help you improve your rankings"
   - ✅ "This approach tends to nudge your rankings upward — sometimes dramatically"

2. SENTENCE FRAGMENT INJECTION (increase burstiness)
   - Add 2-3 deliberate one-sentence or even one-phrase paragraphs
   - These can be standalone thoughts, reactions, or emphasis lines
   - Example: "And that's the part everyone skips."
   - Example: "Simple, but not easy."
   - Example: "That's it. That's the whole strategy."

3. BREAK STRUCTURAL PATTERNS
   - If multiple sections start with the same type of sentence — change one
   - If every bullet point is roughly the same length — shorten one dramatically
   - If every paragraph has 3-4 sentences — make one have just 1

4. ADD SUBTLE IMPERFECTIONS
   - One intentional informal aside in parentheses: (yes, really)
   - One rhetorical question mid-paragraph that isn't answered immediately
   - One sentence that starts with a number: "3 out of 4 times, this approach works."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DO NOT CHANGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- <!-- meta: ... --> comment — preserve exactly
- All headings — exact text
- All keywords — same words, same density
- All links and anchor text [like this](/). DO NOT REMOVE LINKS.
- Markdown formatting
- DO NOT SUMMARIZE OR SHORTEN THE TEXT.

Output ONLY the final blog in clean Markdown. No commentary.`;

/**
 * Stage 7: Two-pass humanization to reduce AI detection below 20%
 * @param blogMarkdown - The blog from writeBlog
 * @returns Humanized blog in Markdown
 */
async function humanize(blogMarkdown: string): Promise<string> {

  // Pass 1 — Deep rewrite for human voice and personality
  const pass1UserMessage = `Rewrite this blog post to sound 100% human-written. 
Apply every humanization technique from your instructions. 
Be aggressive — if a sentence sounds even slightly AI-generated, rewrite it.
Preserve all SEO elements, headings, keywords, meta comment, and links exactly.

BLOG TO HUMANIZE:
${blogMarkdown}`;

  const pass1Result = await callLLM(
    HUMANIZATION_PASS_1,
    pass1UserMessage,
    { json: false }
  ) as string;

  // Pass 2 — Micro-edits to break AI detection patterns
  const pass2UserMessage = `Apply final micro-edits to this blog to break AI detection patterns.
Focus on increasing perplexity, burstiness, and breaking structural repetition.
Do NOT do a full rewrite — only targeted micro-edits.
Preserve all SEO elements, headings, keywords, meta comment, and links exactly.

BLOG TO FINALIZE:
${pass1Result}`;

  const pass2Result = await callLLM(
    HUMANIZATION_PASS_2,
    pass2UserMessage,
    { json: false }
  ) as string;

  return pass2Result;
}

export { humanize };