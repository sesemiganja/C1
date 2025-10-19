import { NextRequest } from "next/server";
import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { transformStream } from "@crayonai/stream";

const client = new OpenAI({
  baseURL: "https://api.thesys.dev/v1/embed",
  apiKey: process.env.THESYS_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    // Validate request body
    const body = await req.json();
    const { prompt, previousC1Response } = body as {
      prompt: string;
      previousC1Response?: string;
    };

    // Validate required fields
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Prompt is required and must be a non-empty string" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate prompt length to prevent abuse
    if (prompt.length > 10000) {
      return new Response(JSON.stringify({ error: "Prompt is too long. Maximum 10,000 characters allowed." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate API key
    if (!process.env.THESYS_API_KEY) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const messages: ChatCompletionMessageParam[] = [];

    if (previousC1Response && typeof previousC1Response === 'string') {
      messages.push({
        role: "assistant",
        content: previousC1Response,
      });
    }

    messages.push({
      role: "user",
      content: prompt.trim(),
    });

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
  } catch (error) {
    console.error("Error in API route:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
