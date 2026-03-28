import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  options: { json?: boolean } = {}
): Promise<any> {
  const { json = false } = options;

  // Force only the best available Groq model
  // Never fall back to 8b — it ignores prompt instructions
  const model = "llama-3.3-70b-versatile";

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[LLM] Calling ${model} (attempt ${attempt}/3)`);

      const completion = await groq.chat.completions.create({
        model,
        temperature: 0.3, // Lower temp = more instruction-following
        max_completion_tokens: json ? 4000 : 12000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        response_format: json ? { type: "json_object" } : { type: "text" },
      });

      const text = completion.choices[0]?.message?.content ?? "";
      if (!text) throw new Error("Empty response from model");

      if (json) {
        const cleaned = text
          .replace(/^```(?:json)?\n?/, "")
          .replace(/\n?```$/, "")
          .trim();
        return JSON.parse(cleaned);
      }

      return text;

    } catch (err: any) {
      const is429 = err.status === 429 || err.message?.includes("429");
      console.warn(`[LLM] Attempt ${attempt} failed: ${is429 ? "RATE LIMITED" : err.message?.substring(0, 80)}`);

      if (is429 && attempt < 3) {
        const wait = attempt * 8000;
        console.log(`[LLM] Waiting ${wait / 1000}s...`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (attempt === 3) throw err;
    }
  }
}