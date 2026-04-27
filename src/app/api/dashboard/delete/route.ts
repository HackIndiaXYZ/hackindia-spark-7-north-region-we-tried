import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { ids } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid or empty IDs array" }, { status: 400 });
    }

    // Prisma doesn't always handle cascading deletes well if it wasn't specified in the schema,
    // so we delete related records sequentially in a transaction to prevent foreign key errors.
    await prisma.$transaction(async (tx) => {
      // 1. Delete evaluations associated with these sessions
      await tx.evaluation.deleteMany({
        where: { sessionId: { in: ids } },
      });

      // 2. Delete video recordings
      await tx.videoRecording.deleteMany({
        where: { sessionId: { in: ids } },
      });

      // 3. Delete resume screenings
      await tx.resumeScreening.deleteMany({
        where: { sessionId: { in: ids } },
      });

      // 4. Finally, delete the interview sessions themselves
      await tx.interviewSession.deleteMany({
        where: { id: { in: ids } },
      });
    });

    return NextResponse.json({ success: true, message: `Deleted ${ids.length} records successfully` });
  } catch (error) {
    console.error("Delete Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
