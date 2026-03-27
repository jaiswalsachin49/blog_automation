import { GoogleGenerativeAI } from "@google/generative-ai";

// We don't import dotenv in Next.js Server Components/API Routes, 
// process.env is automatically populated by Next.js if the standard .env is in the root directory.

/**
 * Call Gemini with system prompt + user message
 * @param {string} systemPrompt - System instructions
 * @param {string} userMessage - User input
 * @param {object} options - { json: boolean, maxRetries: number }
 * @returns {Promise<any>} - Parsed JSON or raw text
 */
export async function callGemini(systemPrompt: string, userMessage: string, options: { json?: boolean, maxRetries?: number } = {}) {
  // Increased default retries to 5 to handle rate limit pauses
  const { json = false, maxRetries = 5 } = options;
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash", // Use the latest 2.5 flash model
    systemInstruction: systemPrompt,
  });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const chat = model.startChat({
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          ...(json && { responseMimeType: "application/json" }),
        },
      });

      const result = await chat.sendMessage(userMessage);
      const text = result.response.text();

      if (json) {
        let cleaned = text.trim();
        if (cleaned.startsWith("\`\`\`")) {
          cleaned = cleaned.replace(/^\`\`\`(?:json)?\n?/, "").replace(/\n?\`\`\`$/, "");
        }
        return JSON.parse(cleaned);
      }

      return text;
    } catch (error: any) {
      console.error(`Gemini call attempt ${attempt}/${maxRetries} failed:`, error.message);

      if (attempt === maxRetries) {
        throw new Error(`Gemini API failed after ${maxRetries} attempts: ${error.message}`);
      }

      let delay = Math.pow(2, attempt) * 1000; // Default exponential backoff: 2s, 4s, 8s, 16s
      
      // If we hit a rate limit (429) or quota error
      if (error.message.includes("429") || error.message.includes("quota") || error.message.includes("Too Many Requests")) {
        console.log("Rate limit hit! Looking for explicit retry time...");
        
        // Try to parse "Please retry in 33.2359s." or "retryDelay":"33s"
        const retryMatch = error.message.match(/retry in ([\d\.]+)s/i) || error.message.match(/"retryDelay":"(\d+)s"/i);
        
        if (retryMatch && retryMatch[1]) {
          const requiredWaitSec = parseFloat(retryMatch[1]);
          console.log(`API requested ${requiredWaitSec}s wait. Sleeping...`);
          delay = (requiredWaitSec * 1000) + 2000; // Add 2 second buffer
        } else {
          delay = 35000 + (attempt * 5000); // 40s wait if we can't parse it
        }
      }

      console.log(`Retrying attempt ${attempt + 1}/${maxRetries} in ${Math.round(delay/1000)}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
