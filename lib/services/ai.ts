import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

type Provider = "anthropic" | "openai" | "ollama";

function resolveProvider(): Provider {
  if (process.env.AI_PROVIDER) {
    return process.env.AI_PROVIDER as Provider;
  }
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "ollama";
}

function resolveModel(provider: Provider): string {
  if (process.env.AI_MODEL) return process.env.AI_MODEL;
  if (provider === "anthropic") return "claude-sonnet-4-5";
  if (provider === "openai") return "gpt-4o-mini";
  return "llama3.2";
}

let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;
let ollamaClient: OpenAI | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function getOllamaClient(): OpenAI {
  if (!ollamaClient) {
    ollamaClient = new OpenAI({
      baseURL: "http://localhost:11434/v1",
      apiKey: "ollama",
    });
  }
  return ollamaClient;
}

async function callLLM(prompt: string, maxTokens: number): Promise<string> {
  const provider = resolveProvider();
  const model = resolveModel(provider);

  if (provider === "anthropic") {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });
    const block = response.content[0];
    return block.type === "text" ? block.text : "";
  }

  // openai or ollama both use the OpenAI-compatible client
  const client = provider === "ollama" ? getOllamaClient() : getOpenAIClient();
  const response = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0]?.message?.content ?? "";
}

export async function summarizeFunction(
  name: string,
  code: string,
  filePath: string
): Promise<string> {
  try {
    const ext = filePath.split(".").pop() ?? "unknown";
    const prompt = `Summarize what the function "${name}" in file "${filePath}" does in 1-2 concise sentences. Focus on its purpose and behavior, not implementation details.\n\n\`\`\`${ext}\n${code.slice(0, 3000)}\n\`\`\``;
    return await callLLM(prompt, 200);
  } catch (err) {
    console.error(`Failed to summarize function "${name}":`, err);
    return "";
  }
}

export async function summarizeFile(
  filePath: string,
  functionSummaries: string[]
): Promise<string> {
  try {
    const summaryList = functionSummaries
      .slice(0, 20)
      .map((s, i) => `${i + 1}. ${s}`)
      .join("\n");
    const prompt = `Summarize the purpose of the file "${filePath}" in 1-2 sentences based on its functions:\n\n${summaryList}`;
    return await callLLM(prompt, 200);
  } catch (err) {
    console.error(`Failed to summarize file "${filePath}":`, err);
    return "";
  }
}

/**
 * Run async tasks with a concurrency limit.
 */
export async function withConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker()
  );
  await Promise.all(workers);
  return results;
}
