require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const Groq = require('groq-sdk');

async function test() {
  const prisma = new PrismaClient();
  const session = await prisma.interviewSession.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { candidate: true, job: true }
  });
  if (!session) return console.log('no session');
  
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY });
  const prompt = `You are an expert... (skipped to save space, just testing API call)
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
}`;

  try {
    const response = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt + "\n\nCandidate Resume:\n" + session.candidate.resumeText.substring(0, 4000) }],
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
      max_tokens: 2048,
    });
    console.log("SUCCESS:", response.choices[0]?.message?.content);
  } catch (e) {
    console.log("ERROR:", e);
  }
}
test();
