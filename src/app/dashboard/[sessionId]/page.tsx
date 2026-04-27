import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User, Briefcase, FileText, BarChart3, MessageSquare, Activity, Code } from "lucide-react";
import { DecisionForm } from "./decision-form";

export default async function DashboardDetailsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: { candidate: true, job: true, evaluation: true, resumeScreening: true },
  });

  if (!session) return notFound();

  let transcript: {role: string, text: string}[] = [];
  try {
    transcript = JSON.parse(session.transcript || "[]");
  } catch (e) {
    console.error(e);
  }

  let codingSubmissions: {
    questionId: string;
    title: string;
    language: string;
    code: string;
    passed: number;
    total: number;
  }[] = [];
  try {
    codingSubmissions = JSON.parse(session.codingTranscript || "[]");
  } catch (e) {
    console.error(e);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Evaluation Report</h1>
            <p className="text-slate-400 text-sm">Session ID: {session.id}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Candidate Info */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
              <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-indigo-400" /> Candidate Profile
              </h3>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-slate-400 mb-1">Name</p>
                  <p className="font-medium text-lg">{session.candidate.name}</p>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">Email</p>
                  <p>{session.candidate.email}</p>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">Role</p>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-300">
                    <Briefcase size={14} />
                    {session.job.title}
                  </div>
                </div>
                <div>
                  <p className="text-slate-400 mb-1 flex items-center gap-1"><FileText size={14}/> Resume / Background</p>
                  <p className="text-slate-300 leading-relaxed bg-slate-900 p-4 rounded-lg mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm border border-white/5">
                    {session.candidate.resumeText}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Screening & Evaluation */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Resume Screening */}
            {session.resumeScreening && (
              <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" /> Resume Screening Results
                  </h3>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wider ${
                    session.resumeScreening.decision === 'SHORTLISTED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    session.resumeScreening.decision === 'REJECTED' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {session.resumeScreening.decision}
                  </div>
                </div>

                <div className="flex items-center gap-8 mb-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-white mb-1">{session.resumeScreening.score}/100</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Match Score</div>
                  </div>
                  <div className="h-12 w-px bg-white/10"></div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-300 leading-relaxed bg-slate-900/50 p-4 rounded-xl border border-white/5 max-h-64 overflow-y-auto whitespace-pre-wrap">
                      {session.resumeScreening.feedback}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* AI Evaluation */}
            {session.evaluation ? (
              <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                <h3 className="font-semibold text-lg flex items-center gap-2 mb-6">
                  <BarChart3 className="w-5 h-5 text-green-400" /> AI Evaluation Results
                </h3>
                
                <div className="flex items-center gap-8 mb-8">
                  <div className="text-center">
                    <div className="text-5xl font-extrabold text-green-400 mb-2">{session.evaluation.overallScore}</div>
                    <div className="text-sm text-slate-400 uppercase tracking-wider font-semibold">Overall</div>
                  </div>
                  <div className="h-16 w-px bg-white/10"></div>
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                      <div className="text-slate-400 text-xs uppercase mb-1">Technical Skills</div>
                      <div className="text-2xl font-bold">{session.evaluation.technicalScore}/100</div>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                      <div className="text-slate-400 text-xs uppercase mb-1">Communication</div>
                      <div className="text-2xl font-bold">{session.evaluation.communicationScore}/100</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-8">
                  {[
                    { label: "Overall", value: session.evaluation.overallScore },
                    { label: "Technical", value: session.evaluation.technicalScore },
                    { label: "Communication", value: session.evaluation.communicationScore },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>{item.label}</span>
                        <span>{Math.round(item.value)}/100</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-indigo-500"
                          style={{ width: `${Math.max(0, Math.min(100, item.value))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-indigo-500/10 border border-indigo-500/20 p-5 rounded-xl">
                  <h4 className="text-indigo-300 font-medium mb-2">AI Feedback</h4>
                  <p className="text-indigo-100/80 leading-relaxed text-sm">
                    {session.evaluation.feedback}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col items-center justify-center text-center py-16">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                  <Activity className="w-8 h-8 text-amber-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Evaluation Pending</h3>
                <p className="text-slate-400 max-w-sm">
                  The candidate has not completed the interview yet. The evaluation will appear here once finished.
                </p>
              </div>
            )}

            <DecisionForm
              sessionId={session.id}
              initialDecision={session.recruiterDecision as "PENDING" | "SHORTLISTED" | "REJECTED" | "HOLD"}
              initialNotes={session.recruiterNotes}
            />

            {/* Transcript */}
            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
              <h3 className="font-semibold text-lg flex items-center gap-2 mb-6">
                <MessageSquare className="w-5 h-5 text-blue-400" /> Interview Transcript
              </h3>
              
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {transcript.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                      msg.role === "user" 
                        ? "bg-slate-800 text-white rounded-tr-none" 
                        : "bg-indigo-500/10 border border-indigo-500/20 text-indigo-100 rounded-tl-none"
                    }`}>
                      <span className="text-xs opacity-50 uppercase block mb-1 font-semibold tracking-wider">
                        {msg.role === "user" ? "Candidate" : "AI Interviewer"}
                      </span>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ))}
                {transcript.length === 0 && (
                  <p className="text-slate-500 text-center py-8">No messages recorded.</p>
                )}
              </div>
            </div>

            {/* Coding Submissions */}
            {codingSubmissions.length > 0 && (
              <div className="bg-white/5 border border-white/10 p-6 rounded-2xl mt-6">
                <h3 className="font-semibold text-lg flex items-center gap-2 mb-6">
                  <Code className="w-5 h-5 text-purple-400" /> Coding Round Submissions
                </h3>
                
                <div className="space-y-6">
                  {codingSubmissions.map((sub, idx) => (
                    <div key={idx} className="bg-slate-900/50 border border-white/5 rounded-xl overflow-hidden">
                      <div className="bg-slate-900 border-b border-white/5 px-4 py-3 flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-slate-200">{sub.title}</h4>
                          <p className="text-xs text-slate-400 mt-0.5">Language: <span className="capitalize">{sub.language}</span></p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wider ${
                          sub.passed === sub.total ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          sub.passed > 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {sub.passed} / {sub.total} Tests Passed
                        </div>
                      </div>
                      <div className="p-4 overflow-x-auto">
                        <pre className="text-sm font-mono text-slate-300">
                          <code>{sub.code}</code>
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
