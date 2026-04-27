import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_DECISIONS = new Set(["PENDING", "SHORTLISTED", "REJECTED", "HOLD"]);

export async function POST(req: Request) {
  try {
    const { sessionId, recruiterDecision, recruiterNotes } = await req.json();
    if (!sessionId || !recruiterDecision) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!ALLOWED_DECISIONS.has(recruiterDecision)) {
      return NextResponse.json({ error: "Invalid recruiter decision" }, { status: 400 });
    }

    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        recruiterDecision,
        recruiterNotes: recruiterNotes || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Decision Update Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
