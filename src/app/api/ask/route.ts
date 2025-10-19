import { NextRequest } from "next/server";
import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { transformStream } from "@crayonai/stream";

/**
 * Lazily create the OpenAI client only when handling a request.
 * This avoids throwing at import-time during Next.js build when env vars are absent.
 */
function createOpenAIClient(): OpenAI {
  const apiKey = process.env.THESYS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "THESYS_API_KEY is missing. Set it in the environment to call the API."
    );
  }

  return new OpenAI({
    baseURL: "https://api.thesys.dev/v1/embed",
    apiKey,
  });
}

export async function POST(req: NextRequest) {
  const { prompt, previousC1Response } = (await req.json()) as {
    prompt: string;
    previousC1Response?: string;
  };

  const messages: ChatCompletionMessageParam[] = [];

  if (previousC1Response) {
    messages.push({
      role: "assistant",
      content: previousC1Response,
    });
  }

  messages.push({
    role: "user",
    content: prompt,
  });

  const client = createOpenAIClient();
  const llmStream = await client.chat.completions.create({
    model: "c1/openai/gpt-5/v-20250915",
    messages: [...messages],
    stream: true,
  });

  const responseStream = transformStream(llmStream, (chunk) => {
    return chunk.choices[0]?.delta?.content || "";
  });

  return new Response(responseStream as ReadableStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
