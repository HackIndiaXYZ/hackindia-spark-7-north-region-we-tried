import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateEvaluationForSession } from "@/lib/interview";

export async function POST(req: Request) {
  try {
    const { sessionId, codingScore, codingSubmissions, cultureResponses } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { evaluation: true },
    });
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (session.evaluation) return NextResponse.json({ success: true, message: "Already evaluated" });

    const evaluation = await generateEvaluationForSession(sessionId, codingScore, codingSubmissions, cultureResponses);
    return NextResponse.json({ success: true, evaluation });
  } catch (error) {
    console.error("Evaluation Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
