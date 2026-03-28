import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function callClaude(
    systemPrompt: string,
    userMessage: string,
    options: { json?: boolean } = {}
): Promise<any> {
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[Claude] Calling claude-sonnet-4-5 (attempt ${attempt}/${MAX_RETRIES})`);

            const response = await client.messages.create({
                model: "claude-sonnet-4-5",
                max_tokens: 8000,
                system: systemPrompt,
                messages: [
                    { role: "user", content: userMessage }
                ],
            });

            const text = response.content[0].type === "text"
                ? response.content[0].text
                : "";

            if (options.json) {
                try {
                    return JSON.parse(text);
                } catch {
                    // Strip markdown code fences if present
                    const cleaned = text
                        .replace(/^```(?:json)?\n?/, "")
                        .replace(/\n?```$/, "")
                        .trim();
                    return JSON.parse(cleaned);
                }
            }

            return text;

        } catch (err: any) {
            const isOverload = err.status === 529 ||
                err.message?.includes("overloaded");
            const isRateLimit = err.status === 429;

            console.error(
                `[Claude] Attempt ${attempt} failed: ${err.message?.substring(0, 120)}`
            );

            if ((isOverload || isRateLimit) && attempt < MAX_RETRIES) {
                const waitTime = attempt * 5000;
                console.log(`[Claude] Waiting ${waitTime / 1000}s before retry...`);
                await new Promise((resolve) => setTimeout(resolve, waitTime));
                continue;
            }

            if (attempt === MAX_RETRIES) throw err;
        }
    }
}