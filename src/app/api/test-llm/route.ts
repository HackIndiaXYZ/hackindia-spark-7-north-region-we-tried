import { NextResponse } from "next/server";
import {
  createGroqClient,
  extractRetryDelaySeconds,
  getGroqModelName,
  isGroqRateLimitError,
} from "@/lib/groq";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const groq = createGroqClient();

    if (!groq) {
      return NextResponse.json(
        { error: "Groq API key is missing. Set GROQ_API_KEY in .env.local and restart the dev server." },
        { status: 400 }
      );
    }

    const completion = await groq.chat.completions.create({
      model: getGroqModelName(),
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });
    const reply = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ reply });

  } catch (error: unknown) {
    console.error("Test LLM Error:", error);
    if (isGroqRateLimitError(error)) {
      const retryAfter = extractRetryDelaySeconds(error);
      return NextResponse.json(
        {
          error: "Groq rate limit exceeded for this project. Wait and retry.",
          retryAfterSeconds: retryAfter,
        },
        { status: 429 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to communicate with Groq";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
