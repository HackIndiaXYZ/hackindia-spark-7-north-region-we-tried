#  AICRUITER — AI-Powered Technical Interview Platform

An autonomous AI interviewer that conducts end-to-end candidate assessment across three rounds — live coding, real-time voice interview, and culture fit — without requiring a human interviewer.

---

##  Features

### For Candidates
- **Round 1 — Live Coding** : In-browser VS Code editor (Monaco), 3 role-specific problems, sandboxed code execution, anti-cheat (fullscreen lock + tab detection), 20-min timer
- **Round 2 — AI Video Interview** : Real-time voice conversation with "Alex" the AI interviewer, adaptive follow-up questions, phased progression (Intro → Technical → Behavioral → Wrapup)
- **Round 3 — Culture Fit** : Likert-scale questionnaire on work style preferences, AI-powered compatibility analysis against company expectations
- **Instant Feedback** : Qualitative AI-generated feedback after completion (no scores shown)

### For Recruiters
- **AI Resume Screening** : Automated scoring on role match, skills, experience, and communication
- **Evaluation Dashboard** : View scores, transcripts, coding results, and culture fit reports
- **Decision Workflow** : Shortlist / Hold / Reject candidates with notes
- **Sort & Filter** : Filter by role, date range picker, newest/oldest toggle
- **Bulk Management** : Select and delete multiple reports at once

### AI Capabilities
- Dynamic follow-up questions based on conversation history
- Role-specific interview templates (Full Stack, Frontend, AI/ML, Database)
- Hallucination prevention — blocks AI from fabricating feedback when candidate didn't participate
- Bias-free culture assessment — evaluates only work-style preference alignment

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Frontend | React 19, Tailwind CSS 4, Framer Motion |
| Code Editor | Monaco Editor |
| Database | SQLite via Prisma ORM |
| AI/LLM | Groq API (LLaMA 3.1 8B) |
| Code Execution | Piston API (sandboxed) |
| Resume Parsing | pdf-parse, mammoth |
| Speech | Web Speech API (browser-native) |
| Video | MediaRecorder API (browser-native) |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher — [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Groq API Key** (optional — app runs in mock mode without it) — [Get one free](https://console.groq.com/)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/HackIndiaXYZ/hackindia-spark-7-north-region-we-tried.git
cd hackindia-spark-7-north-region-we-tried

# 2. Install dependencies
npm install

# 3. Generate the Prisma database client
npx prisma generate

# 4. Create the SQLite database
npx prisma db push

# 5. Start the development server
npm run dev
```

The app will be running at **http://localhost:3000**

### Environment Variables

Create a `.env` file in the root directory:

```env
# Required for real AI functionality (optional — app works in mock mode without it)
GROQ_API_KEY=your_groq_api_key_here

# Optional — customize the model (defaults to llama-3.1-8b-instant)
GROQ_MODEL=llama-3.1-8b-instant

# Optional — use your own Piston instance for code execution
PISTON_URL=https://emkc.org/api/v2/piston/execute
```

#### How to get a free Groq API Key

1. Go to [console.groq.com/keys](https://console.groq.com/keys)
2. Sign up with Google or GitHub (free, no credit card required)
3. Click **"Create API Key"**
4. Copy the key (starts with `gsk_...`) and paste it in your `.env` file

Groq's free tier includes **14,400 requests/day** — more than enough to run the platform.

> **Note:** Without `GROQ_API_KEY`, the entire app runs in **mock mode** with realistic fake AI responses. All UI and flows work — just without real AI evaluation.

---

##  Recruiter Login

To access the recruiter dashboard, navigate to `/login` and use:

| Field | Value |
|---|---|
| **Email** | `admin@interviewai.com` |
| **Password** | `admin123` |

---

##  Project Structure

```
src/
├── app/
│   ├── page.tsx                    → Landing page
│   ├── apply/                      → Candidate application form
│   ├── screening/                  → Resume screening results
│   ├── interview/[sessionId]/      → Main interview experience (all 3 rounds)
│   ├── interview/[sessionId]/feedback/ → Candidate feedback page
│   ├── dashboard/                  → Recruiter dashboard
│   ├── dashboard/[sessionId]/      → Detailed candidate report
│   ├── login/                      → Recruiter authentication
│   └── api/
│       ├── apply/                  → Creates candidate + session
│       ├── parse-resume/           → Extracts text from PDF/DOCX
│       ├── screening/evaluate/     → AI resume screening
│       ├── coding/evaluate/        → Sandboxed code execution
│       ├── interview/chat/stream/  → Real-time AI conversation (SSE)
│       ├── interview/evaluate/     → Final AI evaluation
│       └── dashboard/delete/       → Bulk delete sessions
├── lib/
│   ├── prisma.ts                   → Database client
│   ├── groq.ts                     → AI/LLM client configuration
│   ├── interview-config.ts         → Interview phases, timers, constants
│   ├── interview.ts                → Evaluation engine + culture fit AI
│   ├── coding-round.ts             → Question banks per role template
│   ├── code-wrap.ts                → Test harness wrapper for code execution
│   └── auth.ts                     → Recruiter authentication
└── prisma/
    └── schema.prisma               → Database schema (6 tables)
```

---

##  Database Schema

| Table | Purpose |
|---|---|
| `Job` | Job postings with role templates |
| `Candidate` | Candidate profiles with parsed resume text |
| `InterviewSession` | Links candidates to jobs; stores status, transcript, coding data |
| `Evaluation` | AI-generated scores (overall, technical, communication) and feedback |
| `VideoRecording` | Recorded video URLs per interview question |
| `ResumeScreening` | AI resume screening scores, criteria breakdown, and decisions |

---

##  How It Works

```
Recruiter creates a Job Posting (with role template)
                    ↓
Candidate applies → Uploads Resume → AI screens resume
                    ↓
        ┌─── 3-Round Interview ───┐
        │                         │
        │  Round 1: Live Coding   │  Monaco Editor + Piston API
        │  Round 2: AI Interview  │  Groq LLM + Web Speech API
        │  Round 3: Culture Fit   │  Likert Scale + AI Analysis
        │                         │
        └─────────────────────────┘
                    ↓
    AI generates comprehensive evaluation
                    ↓
    Candidate → Qualitative feedback (no scores)
    Recruiter → Full dashboard with scores + decisions
```

---

##  Error Handling

| Scenario | Behavior |
|---|---|
| No GROQ_API_KEY | Entire app runs in mock mode |
| Groq rate-limited (429) | Falls back to mock scoring |
| Resume parsing fails | Candidate can paste text manually |
| Code execution fails | Returns "execution failed" per test case |
| Empty video transcript | Skips AI evaluation, scores from coding only |
| Candidate doesn't respond | 3-min timer auto-submits, AI moves on |

---

##  Scoring

- **Coding Score** = Test cases passed ÷ Total × 100
- **Communication Score** = AI evaluation of video transcript (0-100)
- **Overall Score** = (Communication × 60%) + (Coding × 40%)
- **Culture Fit** = Separate compatibility score (0-100%) with strengths/mismatches report

---

##  Role Templates

| Template | Coding Language | Focus Area |
|---|---|---|
| Full Stack | JS, Python, C++, Java | System design, API architecture |
| Frontend | JS, Python, C++, Java | UI components, state management |
| AI/ML | Python (locked) | Data science, model evaluation |
| Database | SQL (locked) | Query optimization, schema design |

---



## 🧑‍💻 Built By

**Team WE TRIED** — HackIndia 2026

---
