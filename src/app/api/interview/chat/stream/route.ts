import { prisma } from "@/lib/prisma";
import { createGroqClient, getGroqApiKey, getGroqModelName, isGroqRateLimitError } from "@/lib/groq";
import { generateEvaluationForSession, getTemplateInstruction } from "@/lib/interview";
import { MAX_QUESTION_COUNT, getCurrentPhase } from "@/lib/interview-config";

type TranscriptMessage = { role: string; text: string };

function toSse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  const { sessionId, message, isInitial, phase, timeRemaining } = await req.json();

  if (!sessionId || !message) {
    return new Response(toSse({ type: "error", error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const session = await prisma.interviewSession.findUnique({
          where: { id: sessionId },
          include: { candidate: true, job: true },
        });
        if (!session) {
          controller.enqueue(encoder.encode(toSse({ type: "error", error: "Session not found" })));
          controller.close();
          return;
        }

        let transcript: TranscriptMessage[] = [];
        try {
          transcript = JSON.parse(session.transcript || "[]");
        } catch (error) {
          console.error(error);
        }

        if (!isInitial) {
          transcript.push({ role: "user", text: message });
        }

        const candidateResponsesCount = transcript.filter((item) => item.role === "user").length;
        const shouldAutoComplete = candidateResponsesCount >= MAX_QUESTION_COUNT;
        const currentPhase = phase || getCurrentPhase(candidateResponsesCount);
        const timeLeft = timeRemaining ?? null;
        let aiReply = "";
        let status = session.status;
        let finalSummary: string | null = null;

        const apiKey = getGroqApiKey();
        if (!apiKey) {
          aiReply = isInitial
            ? `Hello ${session.candidate.name}, welcome to the interview for the ${session.job.title} role. Let me start with a scenario — imagine you're building a high-traffic e-commerce platform. How would you design the authentication system to handle millions of concurrent users securely? Walk me through your thought process. (Note: MOCK MODE - Groq API key not set in .env)`
            : "That's an interesting perspective! Can you walk me through how you'd handle that in a real production scenario? (Note: MOCK MODE)";
          controller.enqueue(encoder.encode(toSse({ type: "chunk", text: aiReply })));
        } else {
          const groq = createGroqClient();
          if (!groq) {
            controller.enqueue(encoder.encode(toSse({ type: "error", error: "Groq client initialization failed" })));
            controller.close();
            return;
          }

          let safeResumeText = session.candidate.resumeText || "Candidate did not provide a resume.";
          if (safeResumeText.startsWith("%PDF-") || safeResumeText.includes("\x00")) {
            safeResumeText = "[Resume was in an unreadable format. Ask them about their background directly.]";
          }

          const phaseInstructions: Record<string, string> = {
            INTRO: `You are in the INTRODUCTION phase. Greet the candidate warmly by name, introduce yourself as the interviewer for this role, and make them feel comfortable. Ask one easy warm-up question related to their background or a recent project mentioned in their resume. Keep it light and conversational — this is the icebreaker.`,
            TECHNICAL: `You are in the TECHNICAL DEEP-DIVE phase. Ask challenging scenario-based technical questions. Push for specifics — if the candidate gives a vague answer, ask a follow-up like "Can you be more specific about how you'd implement that?" or "What would happen if that approach fails at scale?" Test their depth, not just breadth. Be a senior engineer who won't settle for surface-level answers.`,
            BEHAVIORAL: `You are in the BEHAVIORAL phase. Ask questions about teamwork, conflict resolution, leadership, handling pressure, and past experiences. Use the STAR method implicitly — ask for specific situations. Example: "Tell me about a time you disagreed with a technical decision on your team. How did you handle it?" Be empathetic but probe for real stories, not hypotheticals.`,
            WRAPUP: `You are in the WRAP-UP phase. This is the final question or closing. Thank the candidate genuinely for their time, briefly mention what impressed you (be specific to something they actually said), and close the interview professionally. Say something like "We'll be in touch with next steps" — make it feel like a real closing, not an abrupt stop.`,
          };

          const systemInstruction = `You are a senior technical interviewer named Alex conducting a live interview for the role of ${session.job.title}.

CANDIDATE INFO:
- Name: ${session.candidate.name}
- Background: ${safeResumeText.substring(0, 3000)}

JOB CONTEXT:
- Role: ${session.job.title}
- Description: ${session.job.description?.substring(0, 500) || "N/A"}
- Template guidance: ${getTemplateInstruction(session.job.template)}

CURRENT INTERVIEW STATE:
- Phase: ${currentPhase}
- Questions answered so far: ${candidateResponsesCount}
- Total questions: ${MAX_QUESTION_COUNT}
${timeLeft != null ? `- Time remaining: ${Math.floor(timeLeft / 60)}m ${timeLeft % 60}s` : ""}

PHASE-SPECIFIC INSTRUCTIONS:
${phaseInstructions[currentPhase] || phaseInstructions["TECHNICAL"]}

CORE INTERVIEWER PERSONALITY:
1. You are conversational, warm but direct. You're a real person, not a chatbot.
2. Use natural filler phrases occasionally: "That's a great point...", "Hmm, interesting approach...", "Right, so..."
3. NEVER ask the candidate to write code — the coding round is already complete.
4. Ask only ONE question at a time. Keep responses to 2-3 sentences max, then your question.
5. If the candidate's answer is vague, short, or surface-level: DO NOT move on. Push back respectfully:
   - "Can you walk me through that step by step?"
   - "What specifically would you do if that approach didn't work?"
   - "I'd love to hear a concrete example from your experience."
6. If the candidate's answer is strong, acknowledge it briefly and genuinely, then move to the next topic.
7. NEVER repeat a topic you've already asked about.
8. If the candidate says "I don't know" — that's okay. Give a brief hint or insight, then move on gracefully. Don't make them feel bad.
9. Transition between phases naturally: "Great, let's shift gears a bit..." or "Now I'd like to understand more about how you work with teams..."
10. If time is running low (< 5 minutes), naturally accelerate toward wrapping up.`;

          const history = transcript.map((msg) => ({
            role: msg.role === "user" ? "user" : "assistant",
            content: msg.text,
          })) as { role: "user" | "assistant"; content: string }[];

          try {
            const userMessage = isInitial
              ? "Begin the interview. Greet the candidate warmly by name, introduce yourself as Alex, and ask your first warm-up question. Be natural and conversational."
              : shouldAutoComplete
                ? "This was the final answer. Wrap up the interview naturally — thank them by name, mention one specific thing they said that impressed you, and close with 'We'll be in touch.' Keep it to 2-3 sentences. Make it feel genuine."
                : message === "[No response — candidate ran out of time]"
                  ? "The candidate didn't answer in time. Acknowledge it gracefully ('No worries, let's move on'), then ask the next question."
                  : message;

            const completion = await groq.chat.completions.create({
              model: getGroqModelName(),
              stream: true,
              messages: [
                { role: "system", content: systemInstruction },
                ...history,
                { role: "user", content: userMessage },
              ],
              temperature: 0.75,
            });

            for await (const chunk of completion) {
              const text = chunk.choices[0]?.delta?.content ?? "";
              if (!text) continue;
              aiReply += text;
              controller.enqueue(encoder.encode(toSse({ type: "chunk", text })));
            }
          } catch (error: unknown) {
            console.error("Groq API Error:", error);
            // Fallback for ANY Groq error (Rate limit, 401 Unauthorized, invalid model, etc.)
            aiReply = isInitial
              ? `Hey ${session.candidate.name}! I'm Alex, and I'll be conducting your interview for the ${session.job.title} role today. Thanks for joining — I've had a chance to look at your background, and I'm excited to learn more. Let's start easy — tell me about the most recent project you've worked on that you're proud of. What was your role, and what made it interesting? (Note: Groq API Error, fallback mode)`
              : "Interesting — can you give me a more concrete example from your experience? Walk me through the specifics. (Note: Groq API Error, fallback mode)";
            controller.enqueue(encoder.encode(toSse({ type: "chunk", text: aiReply })));
          }
        }

        transcript.push({ role: "model", text: aiReply });

        if (shouldAutoComplete) {
          status = "COMPLETED";
        } else if (status === "PENDING") {
          status = "IN_PROGRESS";
        }

        await prisma.interviewSession.update({
          where: { id: sessionId },
          data: { transcript: JSON.stringify(transcript), status },
        });

        if (status === "COMPLETED") {
          const evaluation = await generateEvaluationForSession(sessionId);
          finalSummary = evaluation.feedback;
        }

        controller.enqueue(encoder.encode(toSse({ type: "done", status, finalSummary })));
      } catch (error) {
        console.error("Streaming Chat Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
        controller.enqueue(encoder.encode(toSse({ type: "error", error: errorMessage })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
