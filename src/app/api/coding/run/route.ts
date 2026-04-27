import { NextResponse } from "next/server";
import { CODING_QUESTIONS, CodingLanguage, getPistonLanguage } from "@/lib/coding-round";
import { getWrappedSource } from "@/lib/code-wrap";

const PISTON_URL = process.env.PISTON_URL || "https://emkc.org/api/v2/piston/execute";
const PISTON_RESTRICTION_HINT =
  "Code execution service is restricted. Configure PISTON_URL to your own Piston instance (self-host) to enable Python/Java/C/C++ execution.";

export async function POST(req: Request) {
  try {
    const { code, language, questionId, stdin } = (await req.json()) as {
      code?: string;
      language?: CodingLanguage;
      questionId?: string;
      stdin?: string;
    };

    if (!code || !code.trim()) {
      return NextResponse.json({ error: "Code is required." }, { status: 400 });
    }
    if (!language) {
      return NextResponse.json({ error: "Language is required." }, { status: 400 });
    }
    if (!CODING_QUESTIONS.some((q) => q.id === questionId)) {
      return NextResponse.json({ error: "Invalid question." }, { status: 400 });
    }

    const wrapped = getWrappedSource({ language, questionId: String(questionId), userCode: code });

    const response = await fetch(PISTON_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: getPistonLanguage(language),
        version: "*",
        files: [{ name: wrapped.fileName, content: wrapped.source }],
        stdin: stdin ?? "",
        run_timeout: 5000,
        compile_timeout: 10000,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        {
          error:
            (text && text.slice(0, 500)) ||
            "Failed to execute code.",
          hint: PISTON_RESTRICTION_HINT,
        },
        { status: 503 }
      );
    }

    const payload = (await response.json()) as {
      run?: { stdout?: string; stderr?: string; output?: string; code?: number };
      compile?: { stderr?: string; output?: string; code?: number };
      message?: string;
    };
    if (!response.ok) {
      throw new Error(payload.message || "Failed to execute code.");
    }

    const output = (payload.run?.stdout ?? payload.run?.output ?? "").trim();
    const stderr = (payload.run?.stderr ?? payload.compile?.stderr ?? payload.compile?.output ?? "").trim();

    return NextResponse.json({ success: true, output, stderr }, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to run code." }, { status: 500 });
  }
}
