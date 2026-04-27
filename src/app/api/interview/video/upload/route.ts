import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function getExtensionFromType(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const sessionId = String(formData.get("sessionId") || "");
    const questionIndexRaw = String(formData.get("questionIndex") || "0");
    const durationSecondsRaw = String(formData.get("durationSeconds") || "0");
    const videoFile = formData.get("video");

    if (!sessionId || !videoFile || !(videoFile instanceof File)) {
      return NextResponse.json({ error: "Missing sessionId or video file." }, { status: 400 });
    }

    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const questionIndex = Number.isFinite(Number(questionIndexRaw)) ? Number(questionIndexRaw) : 0;
    const durationSeconds = Number.isFinite(Number(durationSecondsRaw)) ? Math.round(Number(durationSecondsRaw)) : 0;
    const extension = getExtensionFromType(videoFile.type || "");
    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "");
    const fileName = `q${questionIndex || 0}-${Date.now()}.${extension}`;

    const uploadDir = path.join(process.cwd(), "public", "interview-videos", safeSessionId);
    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await videoFile.arrayBuffer());
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    const videoUrl = `/interview-videos/${safeSessionId}/${fileName}`;

    // Persist the recording in the database
    const recording = await prisma.videoRecording.create({
      data: {
        sessionId,
        questionIndex,
        videoUrl,
        durationSeconds,
      },
    });

    return NextResponse.json({
      success: true,
      videoUrl,
      recordingId: recording.id,
      durationSeconds: recording.durationSeconds,
    });
  } catch (error) {
    console.error("Video upload error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
