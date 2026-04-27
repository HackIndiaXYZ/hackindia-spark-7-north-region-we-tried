import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createGroqClient, getGroqModelName } from "@/lib/groq";

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    // 1. Fetch session data
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        candidate: true,
        job: true,
        resumeScreening: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.resumeScreening) {
      // Already screened
      return NextResponse.json(session.resumeScreening, { status: 200 });
    }

    const { resumeText } = session.candidate;
    const { title, description } = session.job;

    if (!resumeText || resumeText.trim().length < 50) {
       // If no resume is provided or it is too short, auto-reject
       const emptyScreening = await prisma.resumeScreening.create({
         data: {
           sessionId,
           score: 0,
           criteriaScores: JSON.stringify({ roleMatch: 0, skillsMatch: 0, experience: 0, communication: 0 }),
           decision: "REJECTED",
           feedback: "The provided resume or background summary is too short or empty. Please provide a detailed resume.",
         }
       });
       return NextResponse.json(emptyScreening, { status: 200 });
    }

    if (resumeText.startsWith("%PDF-") || resumeText.includes("\x00")) {
       // Binary data detected
       const binaryScreening = await prisma.resumeScreening.create({
         data: {
           sessionId,
           score: 0,
           criteriaScores: JSON.stringify({ roleMatch: 0, skillsMatch: 0, experience: 0, communication: 0 }),
           decision: "REJECTED",
           feedback: "We could not read the uploaded file format (PDF/DOCX). Please copy and paste your resume text manually or upload a plain .txt file.",
         }
       });
       return NextResponse.json(binaryScreening, { status: 200 });
    }

    // 2. Call Groq for evaluation
    const groq = createGroqClient();
    if (!groq) {
      return NextResponse.json({ error: "LLM Client not configured" }, { status: 500 });
    }

    const prompt = `
You are an expert technical recruiter evaluating a candidate's resume for the role of "${title}".
Job Description/Context: ${description}

Evaluate the candidate's resume based on the following criteria and provide a score out of 100:
1. Role Match (30 points)
2. Skills Match (40 points)
3. Experience/Projects (20 points)
4. Communication/Presentation of the resume (10 points)

CRITICAL INSTRUCTION: If the "Candidate Resume" is generic, clearly not a real professional background, or contains very little substantive information, you MUST give it a score below 20 and explain why in the feedback. Do not give average scores to empty or meaningless profiles.

Candidate Resume:
${resumeText.substring(0, 4000)} // Truncate to avoid token limits if too long

Return ONLY a valid JSON object matching this schema exactly, with integer values for the scores:
{
  "score": 85,
  "criteriaScores": {
    "roleMatch": 25,
    "skillsMatch": 35,
    "experience": 18,
    "communication": 7
  },
  "feedback": "A SINGLE short sentence explaining the score. DO NOT write more than one sentence."
}
    `.trim();

    const response = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: getGroqModelName(),
      temperature: 0.1, // Even lower temperature to prevent rambling
      response_format: { type: "json_object" },
      max_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Failed to get response from Groq");

    const parsed = JSON.parse(content);
    const score = parsed.score || 0;
    
    // Determine decision
    let decision = "REVIEW";
    if (score >= 65) {
      decision = "SHORTLISTED";
    } else if (score < 40) {
      decision = "REJECTED";
    }

    // 3. Save to database
    const screening = await prisma.resumeScreening.create({
      data: {
        sessionId,
        score,
        criteriaScores: JSON.stringify(parsed.criteriaScores || {}),
        decision,
        feedback: parsed.feedback || "Screening complete.",
      },
    });

    return NextResponse.json(screening, { status: 200 });

  } catch (error: any) {
    console.error("Screening Error:", error);
    return NextResponse.json({ error: "Internal Server Error. Please try again." }, { status: 500 });
  }
}
