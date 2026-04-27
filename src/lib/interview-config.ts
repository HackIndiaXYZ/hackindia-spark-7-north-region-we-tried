export const CHAT_QUESTION_COUNT = 6;
export const VIDEO_QUESTION_COUNT = 6;
export const MAX_QUESTION_COUNT = CHAT_QUESTION_COUNT + VIDEO_QUESTION_COUNT;

// ── Real-life interview settings ──────────────────────────────────────
/** Total interview duration in seconds (60 minutes) */
export const INTERVIEW_DURATION_SECONDS = 60 * 60;

/** Per-answer time limit in seconds */
export const ANSWER_TIME_LIMIT_SECONDS = 180;

/** Random AI "thinking" delay range in milliseconds */
export const THINKING_DELAY_MS = { min: 1500, max: 3000 };

/** Interview phases — the interview flows through these in order */
export type InterviewPhase = "INTRO" | "TECHNICAL" | "BEHAVIORAL" | "WRAPUP";

export const INTERVIEW_PHASES: {
  id: InterviewPhase;
  label: string;
  description: string;
  /** Number of candidate responses after which we move to the NEXT phase */
  endsAfterResponse: number;
}[] = [
  {
    id: "INTRO",
    label: "Introduction",
    description: "Warm-up and getting to know the candidate",
    endsAfterResponse: 2,
  },
  {
    id: "TECHNICAL",
    label: "Technical Deep-Dive",
    description: "Scenario-based technical questions",
    endsAfterResponse: 7,
  },
  {
    id: "BEHAVIORAL",
    label: "Behavioral",
    description: "Soft skills, teamwork, and past experiences",
    endsAfterResponse: 10,
  },
  {
    id: "WRAPUP",
    label: "Wrap-Up",
    description: "Closing the interview",
    endsAfterResponse: MAX_QUESTION_COUNT,
  },
];

/**
 * Returns the current interview phase based on candidate response count.
 */
export function getCurrentPhase(candidateResponses: number): InterviewPhase {
  for (const phase of INTERVIEW_PHASES) {
    if (candidateResponses < phase.endsAfterResponse) {
      return phase.id;
    }
  }
  return "WRAPUP";
}
