import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  try {
    const recordings = await prisma.videoRecording.findMany({
      where: { sessionId },
      orderBy: { questionIndex: "asc" },
    });

    return NextResponse.json({ recordings });
  } catch (error) {
    console.error("Fetch video recordings error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
