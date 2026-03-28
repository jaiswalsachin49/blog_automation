import { GoogleGenerativeAI } from "@google/generative-ai";

// Rate limiter: Gemini free tier allows 15 RPM
let lastGeminiCallTime = 0;
const MIN_DELAY_MS = 4500;

async function rateLimitWait() {
  const now = Date.now();
  const elapsed = now - lastGeminiCallTime;
  if (elapsed < MIN_DELAY_MS && lastGeminiCallTime > 0) {
    const waitTime = MIN_DELAY_MS - elapsed;
    console.log(`[Gemini] Rate limiting: waiting ${Math.round(waitTime / 1000)}s...`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
  lastGeminiCallTime = Date.now();
}

export async function callGemini(
  systemPrompt: string, 
  userMessage: string, 
  options: { json?: boolean } = {}
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Wait to respect rate limits
      await rateLimitWait();

      console.log(`[Gemini] Calling gemini-2.0-flash (attempt ${attempt}/${MAX_RETRIES})`);
      
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: systemPrompt,
      });

      const generationConfig: any = {
        temperature: 0.7,
      };

      if (options.json) {
        generationConfig.responseMimeType = "application/json";
      }

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig,
      });

      const text = result.response.text();
      
      if (options.json) {
        try {
          return JSON.parse(text);
        } catch (e) {
          let cleaned = text.trim();
          if (cleaned.startsWith("\`\`\`")) {
            cleaned = cleaned.replace(/^\`\`\`(?:json)?\n?/, "").replace(/\n?\`\`\`$/, "");
          }
          return JSON.parse(cleaned);
        }
      }
      
      return text;
    } catch (err: any) {
      const is429 = err.message?.includes("429") || err.message?.includes("Too Many Requests");
      console.error(`[Gemini] Attempt ${attempt} failed: ${is429 ? "RATE LIMITED" : err.message?.substring(0, 120)}`);
      
      if (is429 && attempt < MAX_RETRIES) {
        // Wait longer on rate limit (10-15 seconds)
        const waitTime = 10000 + (attempt * 5000);
        console.log(`[Gemini] Rate limited. Waiting ${waitTime / 1000}s before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        lastGeminiCallTime = Date.now();
        continue;
      }
      
      if (attempt === MAX_RETRIES) {
        throw err;
      }
    }
  }
}
