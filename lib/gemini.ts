import { GoogleGenerativeAI } from "@google/generative-ai";

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
  
  // Use gemini-2.5-flash for speed and massive 1M token context
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
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
      console.warn("Failed to parse Gemini JSON output directly. Attempting to clean it.", e);
      let cleaned = text.trim();
      if (cleaned.startsWith("\`\`\`")) {
        cleaned = cleaned.replace(/^\`\`\`(?:json)?\n?/, "").replace(/\n?\`\`\`$/, "");
      }
      return JSON.parse(cleaned);
    }
  }
  
  return text;
}
