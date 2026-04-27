import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { name, email, resumeText, jobTitle, jobTemplate } = await req.json();

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    // 1. Ensure Job exists by title + template
    const normalizedTitle = (jobTitle || "Full Stack Developer").trim();
    const normalizedTemplate = (jobTemplate || "FULLSTACK").trim();
    let job = await prisma.job.findFirst({
      where: {
        title: normalizedTitle,
        template: normalizedTemplate,
      },
    });
    if (!job) {
      job = await prisma.job.create({
        data: {
          title: normalizedTitle,
          template: normalizedTemplate,
          description: "Looking for a skilled professional with strong problem-solving abilities.",
        },
      });
    }

    // 2. Create or update candidate
    const candidate = await prisma.candidate.upsert({
      where: { email },
      update: { name, resumeText },
      create: { name, email, resumeText },
    });

    // 3. Create interview session
    const session = await prisma.interviewSession.create({
      data: {
        jobId: job.id,
        candidateId: candidate.id,
        status: "PENDING",
        transcript: JSON.stringify([]), // Initialize empty chat transcript
      },
    });

    return NextResponse.json({ sessionId: session.id }, { status: 200 });
  } catch (error) {
    console.error("Apply Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
