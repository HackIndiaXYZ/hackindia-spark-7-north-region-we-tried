import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle, AlertCircle, RefreshCw, Home, BrainCircuit } from "lucide-react";

interface FeedbackPageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function FeedbackPage({ params }: FeedbackPageProps) {
  const resolvedParams = await params;
  const { sessionId } = resolvedParams;

  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: {
      candidate: true,
      evaluation: true,
    },
  });

  if (!session) {
    return notFound();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center py-16 px-6 relative overflow-hidden font-sans">
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-3xl z-10">
        <header className="mb-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 mb-6">
            <CheckCircle className="w-10 h-10 text-indigo-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
            Interview Completed
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Great job, {session.candidate?.name || "Candidate"}! Here is the AI-generated qualitative feedback based on your performance.
          </p>
        </header>

        {session.evaluation ? (
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
            
            <div className="flex items-center gap-3 mb-6">
              <BrainCircuit className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-semibold tracking-tight text-white">AI Feedback</h2>
            </div>
            
            <div className="prose prose-invert prose-indigo max-w-none">
              <p className="text-slate-300 leading-relaxed whitespace-pre-wrap text-[1.05rem]">
                {session.evaluation.feedback}
              </p>
            </div>
            
            <div className="mt-10 pt-8 border-t border-white/10">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                <Link 
                  href="/"
                  className="inline-flex items-center justify-center px-8 py-3 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-100 transition-colors w-full sm:w-auto gap-2"
                >
                  <Home className="w-5 h-5" />
                  Return to Dashboard
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-10 text-center shadow-2xl">
            <RefreshCw className="w-12 h-12 text-indigo-400 mx-auto mb-6 animate-spin" />
            <h2 className="text-2xl font-semibold mb-4 text-white">Evaluating Performance...</h2>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              Our AI is currently analyzing your technical answers and coding submissions. This usually takes less than a minute.
            </p>
            <button 
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors cursor-not-allowed opacity-80"
              disabled
            >
              Please Wait...
            </button>
            <script dangerouslySetInnerHTML={{ __html: `setTimeout(() => window.location.reload(), 5000);` }} />
          </div>
        )}
      </div>
    </div>
  );
}
