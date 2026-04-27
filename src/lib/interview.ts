import { prisma } from "@/lib/prisma";
import { createGroqClient, getGroqApiKey, getGroqModelName, isGroqRateLimitError } from "@/lib/groq";

export function getTemplateInstruction(template: string): string {
  switch (template) {
    case "FULLSTACK":
      return "Ask scenario-based questions about full-stack architecture: how they'd design systems end-to-end, handle API scaling, choose databases, debug production issues across frontend and backend, and make technology tradeoffs.";
    case "FRONTEND":
      return "Ask scenario-based questions about frontend architecture: how they'd handle performance bottlenecks, design component systems, manage complex state, ensure accessibility, debug rendering issues, and make UX tradeoffs.";
    case "BACKEND":
      return "Ask scenario-based questions about backend systems: how they'd design APIs for scale, handle database optimization, ensure reliability and fault tolerance, approach microservices vs monolith decisions, and debug production incidents.";
    case "DATA":
      return "Ask scenario-based questions about data systems: how they'd design data pipelines, optimize slow queries, model complex domains, handle data consistency, and communicate analytical findings to non-technical stakeholders.";
    case "AI_ML":
      return "Ask scenario-based questions about AI/ML engineering: model selection and evaluation, feature engineering, handling imbalanced datasets, deploying ML models to production, MLOps pipelines, and tradeoffs between model complexity and interpretability.";
    case "DATABASE":
      return "Ask scenario-based questions about database engineering: SQL query optimization, indexing strategies, normalization vs denormalization tradeoffs, NoSQL (MongoDB) schema design, replication, sharding, handling ACID transactions, and debugging slow queries in production.";
    default:
      return "Ask scenario-based questions about real-world software engineering: system design, debugging production issues, architecture decisions, and technology tradeoffs.";
  }
}

// ── Culture Fit AI Evaluation ──────────────────────────────────────
async function generateCultureFitEvaluation(
  groq: any,
  candidateName: string,
  cultureResponses: { fastPaced: number; collaboration: number; adaptability: number; location: string }
): Promise<string> {
  const likertLabels: Record<number, string> = {
    1: "Strongly Disagree",
    2: "Disagree",
    3: "Neutral",
    4: "Agree",
    5: "Strongly Agree"
  };

  const prompt = `
You are a professional HR culture-fit evaluator. Analyze the following candidate's questionnaire responses and compare them against the company's expectations.

Candidate: ${candidateName}

Candidate Responses (Likert Scale):
1. "I prefer working in a fast-paced environment." → ${likertLabels[cultureResponses.fastPaced] ?? "Neutral"}
2. "I thrive when collaborating closely with a team." → ${likertLabels[cultureResponses.collaboration] ?? "Neutral"}
3. "I am comfortable with rapidly shifting priorities." → ${likertLabels[cultureResponses.adaptability] ?? "Neutral"}

Candidate Preferences:
- Preferred Work Location: ${cultureResponses.location}

Company Expectations:
- Work Style: Fast-paced, agile environment with tight deadlines
- Team Structure: Highly collaborative, cross-functional teams
- Flexibility: Frequent priority shifts based on business needs
- Work Location: Hybrid (mix of remote and onsite)

Instructions:
1. Analyze the candidate's responses and identify:
   - Work style preferences
   - Flexibility level
   - Team collaboration tendency
   - Adaptability to pressure and deadlines
2. Compare candidate preferences with company expectations.
3. Generate:
   a) A compatibility score (0–100%)
   b) Key alignments (where candidate matches company culture)
   c) Potential mismatches (areas of concern)
   d) A short summary (2–3 lines) explaining overall fit
4. Important rules:
   - Do NOT reject the candidate
   - Do NOT use biased or personal attributes (gender, background, etc.)
   - Focus only on preference alignment
   - Keep output professional and explainable

Return STRICT JSON:
{
  "compatibilityScore": number (0-100),
  "strengths": ["string array of key alignments"],
  "mismatches": ["string array of potential mismatches"],
  "summary": "2-3 line summary"
}
`;

  try {
    const completion = await groq.chat.completions.create({
      model: getGroqModelName(),
      messages: [
        { role: "system", content: "Return only valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    });

    const text = completion.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid culture evaluation response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      compatibilityScore?: number;
      strengths?: string[];
      mismatches?: string[];
      summary?: string;
    };

    const lines: string[] = [
      "━━━ CULTURE FIT ASSESSMENT ━━━",
      "",
      `Compatibility Score: ${parsed.compatibilityScore ?? 0}%`,
      "",
      "Strengths:",
      ...(parsed.strengths ?? []).map(s => `  • ${s}`),
      "",
      "Potential Mismatches:",
      ...(parsed.mismatches ?? ["None identified"]).map(m => `  • ${m}`),
      "",
      "Summary:",
      `  ${parsed.summary ?? "N/A"}`,
    ];
    return lines.join("\n");
  } catch (error: unknown) {
    if (isGroqRateLimitError(error)) {
      return "━━━ CULTURE FIT ASSESSMENT ━━━\n\nCompatibility Score: N/A (Rate limit — will be evaluated later)";
    }
    console.error("Culture fit evaluation error:", error);
    return "━━━ CULTURE FIT ASSESSMENT ━━━\n\nCulture evaluation could not be generated at this time.";
  }
}

// ── Main Evaluation Generator ──────────────────────────────────────
export async function generateEvaluationForSession(
  sessionId: string, 
  codingScore: number = 0, 
  codingSubmissions: any = [],
  cultureResponses?: { fastPaced: number; collaboration: number; adaptability: number; location: string }
) {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: { candidate: true, job: true, evaluation: true },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  if (session.evaluation) {
    return session.evaluation;
  }

  const transcript = JSON.parse(session.transcript || "[]") as Array<{ role: string; text: string }>;

  // Count real, substantive candidate responses
  // Exclude: system/timeout messages, very short greetings, single-word replies
  const trivialPatterns = /^\s*(hi|hello|hey|yes|no|ok|okay|sure|thanks|thank you|good|fine|bye)\s*[.!?]*\s*$/i;
  const candidateMessages = transcript.filter(
    (msg) =>
      msg.role === "user" &&
      msg.text.trim() &&
      !msg.text.startsWith("[No response") &&
      !trivialPatterns.test(msg.text.trim()) &&
      msg.text.trim().split(/\s+/).length >= 5 // At least 5 words to count as substantive
  );
  const hasRealVideoRound = candidateMessages.length >= 2;

  let overallScore = 0;
  let technicalScore = 0;
  let communicationScore = 0;
  let feedback = "";

  const apiKey = getGroqApiKey();
  if (!apiKey) {
    overallScore = 85;
    technicalScore = 80;
    communicationScore = 90;
    feedback = "MOCK EVALUATION: Candidate communicates clearly and has fair technical depth. Add deeper architecture examples.";
  } else {
    const groq = createGroqClient();
    if (!groq) {
      throw new Error("Groq client initialization failed");
    }

    if (!hasRealVideoRound) {
      // No meaningful video round interaction — don't let AI hallucinate
      technicalScore = codingScore;
      communicationScore = 0;
      overallScore = codingScore * 0.4; // Only coding contributes
      feedback = "Video/Chat round was not completed — no candidate responses were recorded. The evaluation is based solely on the coding round score.";
    } else {
      const prompt = `
You are an expert technical evaluator. Evaluate the candidate's VIDEO/CHAT round based on this transcript.
Do not evaluate their code here, just their conversational and theoretical knowledge.

Return STRICT JSON with:
{
  "videoScore": number (0-100),
  "feedback": "1 concise paragraph",
  "summary": "2-line recruiter summary"
}

Candidate: ${session.candidate.name}
Role: ${session.job.title}
Interview transcript:
${JSON.stringify(transcript)}
      `;

      try {
        const completion = await groq.chat.completions.create({
          model: getGroqModelName(),
          messages: [
            { role: "system", content: "Return only valid JSON." },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
        });

        const text = completion.choices[0]?.message?.content ?? "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("Invalid evaluation response format");
        }

        const parsed = JSON.parse(jsonMatch[0]) as {
          videoScore?: number;
          feedback?: string;
          summary?: string;
        };

        const videoScore = parsed.videoScore ?? 0;
        technicalScore = codingScore; // 40%
        communicationScore = videoScore; // 60%
        overallScore = (videoScore * 0.6) + (codingScore * 0.4);
        feedback = [parsed.feedback, parsed.summary].filter(Boolean).join("\n\n");
      } catch (error: unknown) {
        if (isGroqRateLimitError(error)) {
          technicalScore = codingScore;
          communicationScore = 80;
          overallScore = (80 * 0.6) + (codingScore * 0.4);
          feedback = "FALLBACK EVALUATION: Groq rate limit exceeded. Temporary mock scoring generated.";
        } else {
          throw error;
        }
      }
    }

    // ── Culture Fit Round ──
    if (cultureResponses && groq) {
      const cultureFeedback = await generateCultureFitEvaluation(
        groq,
        session.candidate.name,
        cultureResponses
      );
      feedback = feedback + "\n\n" + cultureFeedback;
    }
  }

  const evaluation = await prisma.evaluation.create({
    data: {
      sessionId,
      overallScore,
      technicalScore,
      communicationScore,
      feedback,
    },
  });

  await prisma.interviewSession.update({
    where: { id: sessionId },
    data: { 
      status: "COMPLETED",
      codingTranscript: JSON.stringify(codingSubmissions)
    },
  });

  return evaluation;
}
