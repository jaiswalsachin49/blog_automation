import Groq from "groq-sdk";
import { callGemini } from "./gemini";

/**
 * Groq rate limits are PER MODEL. If llama-3.3-70b is exhausted,
 * mixtral-8x7b or llama-3.1-8b might still have fresh quota.
 */
const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
];

export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  options: { json?: boolean } = {}
) {
  const { json = false } = options;
  const errors: string[] = [];

  // ── Step 1: Try Groq with multiple models ─────────────────────────────
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const groq = new Groq({ apiKey: groqKey });

    for (const model of GROQ_MODELS) {
      try {
        console.log(`[LLM] Trying Groq model: ${model}`);

        const completion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          model,
          temperature: 0.7,
          ...(json ? { max_completion_tokens: 2000 } : { max_completion_tokens: 8000 }),
          response_format: json ? { type: "json_object" } : { type: "text" },
        });

        const text = completion.choices[0]?.message?.content || "";

        if (json) {
          let cleaned = text.trim();
          if (cleaned.startsWith("\`\`\`")) {
            cleaned = cleaned.replace(/^\`\`\`(?:json)?\n?/, "").replace(/\n?\`\`\`$/, "");
          }
          return JSON.parse(cleaned);
        }

        return text;
      } catch (error: any) {
        const msg = error.message?.substring(0, 100) || "Unknown error";
        const is429 = error.status === 429 || msg.includes("429");
        console.warn(`[LLM] Groq ${model}: ${is429 ? "RATE LIMITED" : msg}`);
        errors.push(`Groq/${model}: ${is429 ? "rate limited" : msg}`);
        // Try next model
      }
    }
  }

  // ── Step 2: Fallback to Gemini ─────────────────────────────────────────
  try {
    console.log("[LLM] All Groq models exhausted. Trying Gemini...");
    return await callGemini(systemPrompt, userMessage, { json });
  } catch (geminiError: any) {
    errors.push(`Gemini: ${geminiError.message?.substring(0, 100)}`);
  }

  // ── Step 3: All failed ─────────────────────────────────────────────────
  throw new Error(
    `All LLM providers failed:\n${errors.map((e) => `  • ${e}`).join("\n")}`
  );
}