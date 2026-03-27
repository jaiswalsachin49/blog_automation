import Groq from "groq-sdk";

export async function callLLM(systemPrompt: string, userMessage: string, options: { json?: boolean, maxRetries?: number } = {}) {
  // Groq is so fast we can afford a few retries, but we shouldn't hit 429s as easily
  const { json = false, maxRetries = 3 } = options;
  
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is missing.");
  }
  
  const groq = new Groq({ apiKey });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_completion_tokens: 8000,
        response_format: json ? { type: "json_object" } : { type: "text" },
      });

      const text = completion.choices[0]?.message?.content || "";

      if (json) {
        // Groq guarantees JSON if response_format is set, but let's be safe
        let cleaned = text.trim();
        if (cleaned.startsWith("\`\`\`")) {
          cleaned = cleaned.replace(/^\`\`\`(?:json)?\n?/, "").replace(/\n?\`\`\`$/, "");
        }
        return JSON.parse(cleaned);
      }

      return text;
    } catch (error: any) {
      console.error(`Groq call attempt ${attempt}/${maxRetries} failed:`, error.message);

      if (attempt === maxRetries) {
        throw new Error(`Groq API failed after ${maxRetries} attempts: ${error.message}`);
      }

      let delay = Math.pow(2, attempt) * 1000;
      
      if (error.status === 429 || (error.message && error.message.includes("429"))) {
        console.log("Rate limit hit! Looking for explicit retry time...");
        
        const retryMatch = error.message.match(/Please try again in ([\d\.]+)s/i);
        
        if (retryMatch && retryMatch[1]) {
          const requiredWaitSec = parseFloat(retryMatch[1]);
          console.log(`API requested ${requiredWaitSec}s wait. Sleeping...`);
          delay = (requiredWaitSec * 1000) + 1000;
        } else {
          delay = 10000 + (attempt * 2000); 
        }
      }

      console.log(`Retrying attempt ${attempt + 1}/${maxRetries} in ${Math.round(delay/1000)}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
