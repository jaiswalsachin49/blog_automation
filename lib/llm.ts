import Groq from "groq-sdk";

// ─── Multi-Key Groq Pool ──────────────────────────────────────────────────────

// Load all GROQ API keys from env: GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3, etc.
interface GroqSlot {
  client: Groq;
  label: string;
  tokensUsed: number;
  windowStart: number;
  cooldownUntil: number;
}

function loadGroqPool(): GroqSlot[] {
  const keys: string[] = [];

  // Primary key
  if (process.env.GROQ_API_KEY) keys.push(process.env.GROQ_API_KEY);
  // Additional keys: GROQ_API_KEY_2, GROQ_API_KEY_3, ...
  for (let i = 2; i <= 10; i++) {
    const key = process.env[`GROQ_API_KEY_${i}`];
    if (key) keys.push(key);
  }

  if (keys.length === 0) {
    throw new Error("No GROQ_API_KEY found in environment variables");
  }

  console.log(`[LLM] Loaded ${keys.length} Groq API key(s)`);

  return keys.map((key, idx) => ({
    client: new Groq({ apiKey: key }),
    label: `Key-${idx + 1}`,
    tokensUsed: 0,
    windowStart: Date.now(),
    cooldownUntil: 0,
  }));
}

let pool: GroqSlot[] | null = null;

function getPool(): GroqSlot[] {
  if (!pool) pool = loadGroqPool();
  return pool;
}

// ─── Token Tracking ───────────────────────────────────────────────────────────

const TPM_LIMIT = 12000;
const SAFE_BUDGET = 11500; // Closer to actual limit of 12k
const WINDOW_MS = 65_000; // Slightly over 1 min to be safe

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

function resetWindowIfNeeded(slot: GroqSlot) {
  if (Date.now() - slot.windowStart > WINDOW_MS) {
    slot.tokensUsed = 0;
    slot.windowStart = Date.now();
  }
}

// Pick the best available slot (lowest usage, not in cooldown)
function pickSlot(estimatedTokens: number): GroqSlot | null {
  const now = Date.now();
  const slots = getPool();

  // Reset expired windows & cooldowns
  for (const s of slots) {
    resetWindowIfNeeded(s);
    if (s.cooldownUntil > 0 && now >= s.cooldownUntil) {
      s.cooldownUntil = 0;
      s.tokensUsed = 0;
      s.windowStart = now;
    }
  }

  // If a request is exceptionally large, cap its estimate so it can at least run on a fresh key
  const requiredBudget = Math.min(estimatedTokens, SAFE_BUDGET);

  // Find slots that have enough budget and aren't cooling down
  const available = slots
    .filter(s => s.cooldownUntil === 0 || now >= s.cooldownUntil)
    .filter(s => (SAFE_BUDGET - s.tokensUsed) >= requiredBudget)
    .sort((a, b) => a.tokensUsed - b.tokensUsed);

  return available[0] ?? null;
}

function cooldownSlot(slot: GroqSlot, retryAfterSec?: number) {
  const cooldownMs = (retryAfterSec ?? 65) * 1000;
  slot.cooldownUntil = Date.now() + cooldownMs;
  slot.tokensUsed = SAFE_BUDGET; // Mark as exhausted
  console.log(`[LLM] ${slot.label} in cooldown for ${Math.round(cooldownMs / 1000)}s`);
}

// ─── Main Call Function ───────────────────────────────────────────────────────

export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  options: { json?: boolean; maxTokens?: number } = {}
): Promise<any> {
  const { json = false } = options;
  // Smaller max tokens to stay under TPM
  const maxCompletionTokens = options.maxTokens ?? (json ? 3500 : 5000);
  const model = "llama-3.3-70b-versatile";

  const inputEstimate = estimateTokens(systemPrompt + userMessage);
  const totalEstimate = inputEstimate + maxCompletionTokens;

  for (let attempt = 1; attempt <= 5; attempt++) {
    // Pick the best available key
    const slot = pickSlot(totalEstimate);

    if (!slot) {
      // All keys exhausted — wait for the earliest cooldown to expire
      const slots = getPool();
      const earliest = Math.min(...slots.map(s => s.cooldownUntil || s.windowStart + WINDOW_MS));
      const waitMs = Math.max(earliest - Date.now(), 5000);
      console.log(`[LLM] All ${slots.length} keys exhausted. Waiting ${Math.round(waitMs / 1000)}s for reset...`);
      await new Promise(r => setTimeout(r, waitMs));
      // Reset all windows after waiting
      for (const s of slots) {
        s.tokensUsed = 0;
        s.windowStart = Date.now();
        s.cooldownUntil = 0;
      }
      continue;
    }

    try {
      console.log(`[LLM] ${slot.label} → Groq (attempt ${attempt}, ~${totalEstimate} tokens, budget: ${slot.tokensUsed}/${SAFE_BUDGET})`);

      const completion = await slot.client.chat.completions.create({
        model,
        temperature: 0.3,
        max_completion_tokens: maxCompletionTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        response_format: json ? { type: "json_object" } : { type: "text" },
      });

      const text = completion.choices[0]?.message?.content ?? "";
      if (!text) throw new Error("Empty response from Groq");

      // Track actual usage from response if available
      const usage = completion.usage;
      if (usage) {
        slot.tokensUsed += (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0);
        console.log(`[LLM] ${slot.label} used ${usage.prompt_tokens}+${usage.completion_tokens} tokens (total window: ${slot.tokensUsed}/${SAFE_BUDGET})`);
      } else {
        slot.tokensUsed += totalEstimate;
      }

      if (json) {
        const cleaned = text
          .replace(/^```(?:json)?\n?/, "")
          .replace(/\n?```$/, "")
          .trim();
        return JSON.parse(cleaned);
      }

      return text;

    } catch (err: any) {
      const msg = err.message ?? "";
      const isRateLimit =
        err.status === 429 ||
        msg.includes("429") ||
        msg.includes("rate_limit") ||
        msg.includes("Request too large") ||
        msg.includes("tokens per minute");

      console.warn(`[LLM] ${slot.label} attempt ${attempt} failed: ${msg.substring(0, 120)}`);

      if (isRateLimit) {
        // Parse retry-after from error headers if available
        const retryAfter = parseRetryAfter(err);
        cooldownSlot(slot, retryAfter);

        // If we have other keys, immediately retry with the next one
        const nextSlot = pickSlot(totalEstimate);
        if (nextSlot) {
          console.log(`[LLM] Switching to ${nextSlot.label}`);
          continue;
        }

        // No other keys available — wait and retry
        const waitSec = retryAfter ?? 65;
        console.log(`[LLM] All keys rate-limited. Waiting ${waitSec}s...`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        // Reset all slots after waiting
        for (const s of getPool()) {
          s.tokensUsed = 0;
          s.windowStart = Date.now();
          s.cooldownUntil = 0;
        }
        continue;
      }

      // Non-rate-limit error — backoff and retry
      if (attempt < 5) {
        const wait = attempt * 3000;
        console.log(`[LLM] Retrying in ${wait / 1000}s...`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      throw err;
    }
  }

  throw new Error("All LLM attempts exhausted after 5 retries across all API keys");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseRetryAfter(err: any): number | undefined {
  try {
    // Groq errors sometimes include retry-after in headers
    const headers = err.headers;
    if (headers) {
      const retryAfter = headers.get?.("retry-after") ?? headers["retry-after"];
      if (retryAfter) return parseInt(retryAfter, 10);
    }
    // Try to parse from error message like "7m12s"
    const match = err.message?.match(/retry.after.*?(\d+)m(\d+)s/i);
    if (match) return parseInt(match[1]) * 60 + parseInt(match[2]);

    const secMatch = err.message?.match(/retry.after.*?(\d+)s/i);
    if (secMatch) return parseInt(secMatch[1]);
  } catch {}
  return undefined;
}