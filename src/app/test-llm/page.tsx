"use client";

import { useState } from "react";
import { Bot, Send, CheckCircle, XCircle } from "lucide-react";

export default function TestLLMPage() {
  const [prompt, setPrompt] = useState("Tell me a one-sentence joke about programming.");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const testAPI = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResponse("");
    setStatus("idle");

    try {
      const res = await fetch("/api/test-llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      if (res.ok) {
        setResponse(data.reply);
        setStatus("success");
      } else {
        setResponse(data.error);
        setStatus("error");
      }
    } catch (err: unknown) {
      setResponse(err instanceof Error ? err.message : "An unexpected error occurred");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-6">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Bot size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Test Groq API</h1>
            <p className="text-slate-400 text-sm">Verify your API key is working correctly</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Test Prompt</label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            onClick={testAPI}
            disabled={loading || !prompt.trim()}
            className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send size={18} /> Test API Key
              </>
            )}
          </button>

          {response && (
            <div className={`mt-6 p-4 rounded-xl border ${status === "success"
              ? "bg-green-500/10 border-green-500/20 text-green-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}>
              <div className="flex items-center gap-2 mb-2 font-semibold">
                {status === "success" ? <CheckCircle size={18} /> : <XCircle size={18} />}
                {status === "success" ? "Success!" : "Error"}
              </div>
              <p className="text-sm whitespace-pre-wrap">{response}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
