"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Clock, Loader2, ArrowRight } from "lucide-react";

type ScreeningResult = {
  score: number;
  decision: "SHORTLISTED" | "REJECTED" | "REVIEW";
  feedback: string;
  criteriaScores: string;
};

export default function ScreeningPage() {
  const { sessionId } = useParams();
  const router = useRouter();
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const evaluateResume = async () => {
      try {
        const res = await fetch("/api/screening/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Evaluation failed");
        setResult(data);
      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    evaluateResume();
  }, [sessionId]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-white">
        <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl max-w-md w-full text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Screening Error</h2>
          <p className="text-red-400 text-sm mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-slate-950 text-white">
      {/* Background Gradients */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <div className="w-full max-w-2xl relative">
        {loading ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
          >
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 border-t-2 border-indigo-500 rounded-full animate-spin"></div>
              <div className="absolute inset-2 border-r-2 border-blue-400 rounded-full animate-[spin_1.5s_linear_infinite_reverse]"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 mb-2">
                AI Resume Analysis in Progress
              </h2>
              <p className="text-slate-400 text-sm">
                Evaluating role match, extracting skills, and assessing experience...
              </p>
            </div>
          </motion.div>
        ) : result ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 backdrop-blur-xl p-8 rounded-3xl shadow-2xl overflow-hidden relative"
          >
            {/* Status Header */}
            <div className="text-center mb-8 relative z-10">
              {result.decision === "SHORTLISTED" && (
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/30 mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </div>
              )}
              {result.decision === "REJECTED" && (
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/20 border border-red-500/30 mb-6 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                  <XCircle className="w-10 h-10 text-red-400" />
                </div>
              )}
              {result.decision === "REVIEW" && (
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/20 border border-amber-500/30 mb-6 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                  <Clock className="w-10 h-10 text-amber-400" />
                </div>
              )}

              <h1 className="text-3xl font-bold text-white mb-3">
                {result.decision === "SHORTLISTED" && "You've Been Shortlisted!"}
                {result.decision === "REJECTED" && "Application Status Update"}
                {result.decision === "REVIEW" && "Application Under Review"}
              </h1>
              <p className="text-slate-300 max-w-md mx-auto text-sm leading-relaxed">
                {result.feedback}
              </p>
            </div>

            {/* AI Score Breakdown */}
            <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 mb-8">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-slate-400">Overall Match Score</span>
                <span className="text-2xl font-bold text-white">{result.score}/100</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-6">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${result.score}%` }}
                  transition={{ duration: 1, delay: 0.2 }}
                  className={`h-full ${
                    result.score >= 65 ? "bg-emerald-500" : result.score >= 40 ? "bg-amber-500" : "bg-red-500"
                  }`}
                />
              </div>
            </div>

            {/* Action Buttons */}
            {result.decision === "SHORTLISTED" && (
              <button
                onClick={() => router.push(`/interview/${sessionId}`)}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white py-4 rounded-xl font-medium transition-all shadow-lg hover:shadow-indigo-500/25"
              >
                Proceed to Video Interview
                <ArrowRight className="w-5 h-5" />
              </button>
            )}

            {result.decision !== "SHORTLISTED" && (
              <button
                onClick={() => router.push("/")}
                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors"
              >
                Return to Home
              </button>
            )}
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
