import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { sessionId, reason } = (await req.json()) as { sessionId?: string; reason?: string };
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const notes = reason ? `AUTO-CANCELLED: ${reason}` : "AUTO-CANCELLED";

    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
        recruiterDecision: "REJECTED",
        recruiterNotes: notes,
      },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Cancel session error:", error);
    return NextResponse.json({ error: "Failed to cancel session" }, { status: 500 });
  }
}

