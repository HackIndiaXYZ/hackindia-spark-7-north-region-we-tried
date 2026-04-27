import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createGroqClient, getGroqApiKey, getGroqModelName, isGroqRateLimitError } from "@/lib/groq";
import { generateEvaluationForSession, getTemplateInstruction } from "@/lib/interview";
import { MAX_QUESTION_COUNT } from "@/lib/interview-config";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: { job: true },
  });

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  let transcript = [];
  try {
    transcript = JSON.parse(session.transcript || "[]");
  } catch (e) {
    console.error(e);
  }

  return NextResponse.json({ status: session.status, transcript, role: session.job?.template || "GENERAL" });
}

export async function POST(req: Request) {
  const { sessionId, message, isInitial } = await req.json();

  if (!sessionId || !message) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { candidate: true, job: true },
    });

    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    let transcript: {role: string, text: string}[] = [];
    try {
      transcript = JSON.parse(session.transcript || "[]");
    } catch (e) {
      console.error(e);
    }

    // Add user message if it's not the initial trigger
    if (!isInitial) {
      transcript.push({ role: "user", text: message });
    }

    let aiReply = "";
    let status = session.status;
    let finalSummary: string | null = null;
    const candidateResponsesCount = transcript.filter((item) => item.role === "user").length;
    const shouldAutoComplete = candidateResponsesCount >= MAX_QUESTION_COUNT;

    // If no API key is provided, use a mock response to prevent breaking the flow during demo
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      aiReply = isInitial 
        ? `Hello ${session.candidate.name}, welcome to the coding round for the ${session.job.title} role. Let's begin with a coding problem: design and implement a secure API endpoint with input validation and proper error handling. (Note: MOCK MODE - Groq API key not set in .env)`
        : "That's interesting! Can you elaborate more on your experience with this technology? (Note: MOCK MODE)";
    } else {
      // Use Groq API
      const groq = createGroqClient();
      if (!groq) {
        return NextResponse.json({ error: "Groq client initialization failed" }, { status: 500 });
      }
      
      let safeResumeText = session.candidate.resumeText || "Candidate did not provide a resume.";
      if (safeResumeText.startsWith("%PDF-") || safeResumeText.includes("\x00")) {
        safeResumeText = "[The candidate's resume was uploaded in an unreadable binary format. Please ask them directly about their background and experience instead of referring to the resume document.]";
      }

      const systemInstruction = `You are a professional technical interviewer hiring for the role of ${session.job.title}.
    
Job Description:
${session.job.description}

Candidate Profile:
Name: ${session.candidate.name}
Resume/Background: ${safeResumeText.substring(0, 3000)}

Interview template guidance: ${getTemplateInstruction(session.job.template)}.
        
        Guidelines:
        1. Keep responses concise (1-2 short paragraphs).
        2. Ask only ONE question at a time.
        3. Do not be overly polite or robotic; act like a real, experienced software engineer.
        4. If the candidate answers well, acknowledge it briefly and move to the next technical topic.
        5. If they don't know, provide a small hint or move on.
        6. After 5-6 questions, wrap up the interview by thanking them.
      `;

      const history = transcript.map((msg) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.text,
      })) as { role: "user" | "assistant"; content: string }[];

      try {
        const completion = await groq.chat.completions.create({
          model: getGroqModelName(),
          messages: [
            { role: "system", content: systemInstruction },
            ...history,
            {
              role: "user",
              content:
                isInitial
                  ? `Start directly with the coding round for a ${session.job.title}. Do not ask background/introduction questions first. Ask one practical coding question relevant to their field.`
                  : shouldAutoComplete
                    ? "This was the final candidate answer. Wrap up the interview in 2-3 lines, thank them, and clearly state interview is complete."
                    : message,
            },
          ],
          temperature: 0.7,
        });
        aiReply = completion.choices[0]?.message?.content ?? "";
      } catch (error: unknown) {
        if (isGroqRateLimitError(error)) {
          aiReply = isInitial
            ? `Hello ${session.candidate.name}, welcome to the coding round for the ${session.job.title} role. Let's begin with a practical problem relevant to your field. (Note: Groq rate limit exceeded, running in fallback mode)`
            : "Thanks for your response. Please continue with one concrete example from your past project. (Note: Groq rate limit exceeded, running in fallback mode)";
        } else {
          throw error;
        }
      }
    }

    transcript.push({ role: "model", text: aiReply });

    if (shouldAutoComplete) {
      status = "COMPLETED";
    } else if (status === "PENDING") {
      status = "IN_PROGRESS";
    }

    // Update DB
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        transcript: JSON.stringify(transcript),
        status,
      },
    });

    if (status === "COMPLETED") {
      const evaluation = await generateEvaluationForSession(sessionId);
      finalSummary = evaluation.feedback;
    }

    return NextResponse.json({ reply: aiReply, status, finalSummary });
  } catch (error) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
