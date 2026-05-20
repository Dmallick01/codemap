import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to .env.local to enable AI summarization."
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

const MODEL = "claude-sonnet-4-20250514";

export async function summarizeFunction(
  code: string,
  language: string,
  functionName: string
): Promise<string> {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Summarize what this ${language} function "${functionName}" does in 1-2 concise sentences. Focus on its purpose and behavior, not implementation details.\n\n\`\`\`${language}\n${code.slice(0, 3000)}\n\`\`\``,
      },
    ],
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}

export async function summarizeFile(
  filePath: string,
  functionSummaries: string[]
): Promise<string> {
  const anthropic = getClient();
  const summaryList = functionSummaries
    .slice(0, 20)
    .map((s, i) => `${i + 1}. ${s}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Summarize the purpose of the file "${filePath}" in 1-2 sentences based on its functions:\n\n${summaryList}`,
      },
    ],
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : "";
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
