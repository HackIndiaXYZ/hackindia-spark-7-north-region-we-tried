import { NextResponse } from "next/server";
import { CODING_QUESTIONS_BY_ROLE, CodingLanguage, getPistonLanguage } from "@/lib/coding-round";
import { getWrappedSource } from "@/lib/code-wrap";

const PISTON_URL = process.env.PISTON_URL || "https://emkc.org/api/v2/piston/execute";
const PISTON_RESTRICTION_HINT =
  "Code execution service is restricted. Configure PISTON_URL to your own Piston instance (self-host) to enable Python/Java/C/C++ execution.";

export async function POST(req: Request) {
  try {
    const { code, language, questionId } = (await req.json()) as {
      code?: string;
      language?: CodingLanguage;
      questionId?: string;
    };

    if (!code || !code.trim()) {
      return NextResponse.json({ error: "Code is required." }, { status: 400 });
    }
    if (!language) {
      return NextResponse.json({ error: "Language is required." }, { status: 400 });
    }
    const allQuestions = Object.values(CODING_QUESTIONS_BY_ROLE).flat();
    const question = allQuestions.find((q) => q.id === questionId);
    if (!question) return NextResponse.json({ error: "Invalid question." }, { status: 400 });

    const startedAt = Date.now();
    const wrapped = getWrappedSource({ language, questionId: question.id, userCode: code });

    const testResults: Array<{
      index: number;
      passed: boolean;
      input: string;
      expected: string;
      actual: string | null;
      error: string | null;
    }> = [];
    for (let idx = 0; idx < question.tests.length; idx += 1) {
      const test = question.tests[idx];
      try {
        const response = await fetch(PISTON_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language: getPistonLanguage(language),
            version: "*",
            files: [
              {
                name: wrapped.fileName,
                content: language === "sql" ? `${test.input}\n${wrapped.source}` : wrapped.source,
              },
            ],
            stdin: language === "sql" ? "" : test.input,
            run_timeout: 5000,
            compile_timeout: 10000,
          }),
        });
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error((text && text.slice(0, 200)) || PISTON_RESTRICTION_HINT);
        }
        const payload = (await response.json()) as {
          run?: { stdout?: string; stderr?: string; output?: string; time?: number; memory?: number };
          compile?: { stderr?: string; output?: string };
          message?: string;
        };
        if (!response.ok) {
          throw new Error(payload.message || "Execution failed");
        }

        const actual = (payload.run?.stdout ?? payload.run?.output ?? "").trim();
        const expected = test.output.trim();
        const passed = actual === expected;
        testResults.push({
          index: idx + 1,
          passed,
          input: test.input.trim(),
          expected,
          actual,
          error: passed ? null : "Output mismatch",
        });
      } catch (error) {
        testResults.push({
          index: idx + 1,
          passed: false,
          input: test.input.trim(),
          expected: test.output.trim(),
          actual: null,
          error: error instanceof Error ? error.message : "Runtime error",
        });
      }
    }

    const normalized = testResults.length ? testResults : question.tests.map((t, idx) => ({
      index: idx + 1, passed: false, input: t.input.trim(), expected: t.output.trim(), actual: null, error: "Execution failed",
    }));
    const passedCount = normalized.filter((r) => r.passed).length;
    const allPassed = passedCount === question.tests.length;

    return NextResponse.json(
      {
        success: allPassed,
        passedCount,
        totalCount: question.tests.length,
        elapsedMs: Date.now() - startedAt,
        memoryMb: payloadMemoryToMb(testResults),
        testResults: normalized,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to evaluate code." }, { status: 500 });
  }
}

function payloadMemoryToMb(
  _testResults: Array<{ index: number; passed: boolean; input: string; expected: string; actual: string | null; error: string | null }>
): number | null {
  // The public API may not provide memory. Keep null unless you run a Piston instance that returns it.
  return null;
}
