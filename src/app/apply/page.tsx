"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, User, Mail, FileText, Briefcase } from "lucide-react";

export default function ApplyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeFileName, setResumeFileName] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    resumeText: "",
    jobTitle: "Full Stack Developer", // Default for the hackathon
    jobTemplate: "FULLSTACK",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/interview/${data.sessionId}`);
      } else {
        alert("Failed to submit application");
      }
    } catch (error) {
      console.error(error);
      alert("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleResumeUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingResume(true);
    try {
      const fileName = file.name.toLowerCase();
      // Plain text formats that can be read directly in the browser
      const isPlainText =
        fileName.endsWith(".txt") ||
        fileName.endsWith(".md") ||
        fileName.endsWith(".csv") ||
        fileName.endsWith(".json");

      if (isPlainText) {
        // Read text files directly on the client
        const rawText = await file.text();
        setFormData((prev) => ({ ...prev, resumeText: rawText }));
      } else {
        // Send all other files (PDF, DOC, DOCX, RTF, etc.) to the server for parsing
        const uploadData = new FormData();
        uploadData.append("file", file);
        const res = await fetch("/api/parse-resume", {
          method: "POST",
          body: uploadData,
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to parse document");
        }
        const data = await res.json();
        setFormData((prev) => ({ ...prev, resumeText: data.text }));
      }
      setResumeFileName(file.name);
    } catch (error) {
      console.error(error);
      alert("Could not read this file. Please try a PDF, DOCX, or TXT file.");
    } finally {
      setUploadingResume(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute inset-0 -z-10 bg-slate-950">
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-indigo-500/10 blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-blue-500/10 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg bg-white/5 border border-white/10 backdrop-blur-xl p-8 rounded-3xl shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/20 border border-indigo-500/30 mb-4">
            <Briefcase className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Join Our Team</h1>
          <p className="text-slate-400">Fill out your details to start the AI interview.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 ml-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                required
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="email"
                required
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 ml-1">Upload CV (PDF, Word, or Text)</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.rtf,.txt,.md,.csv,.json,.odt"
              onChange={(e) => handleResumeUpload(e.target.files?.[0] ?? null)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 px-4 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-500 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-indigo-600"
            />
            <p className="text-xs text-slate-400 ml-1">
              {uploadingResume
                ? "Parsing resume..."
                : resumeFileName
                  ? `✓ Loaded: ${resumeFileName}`
                  : "Supports PDF, DOCX, DOC, RTF, TXT, and more."}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 ml-1">Interview Template</label>
            <select
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              value={formData.jobTemplate}
              onChange={(e) => {
                const template = e.target.value;
                const titleMap: Record<string, string> = {
                  FULLSTACK: "Full Stack Developer",
                  AI_ML: "AI/ML Engineer",
                  DATABASE: "Database Engineer",
                };
                setFormData({ ...formData, jobTemplate: template, jobTitle: titleMap[template] || "Full Stack Developer" });
              }}
            >
              <option value="FULLSTACK">Full Stack Developer</option>
              <option value="AI_ML">AI/ML Engineer</option>
              <option value="DATABASE">Database Engineer (SQL/MongoDB)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 ml-1">Brief Background / Resume Summary</label>
            <div className="relative">
              <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-500" />
              <textarea
                required
                rows={4}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                placeholder="I am a software engineer with 3 years of experience in React and Node.js..."
                value={formData.resumeText}
                onChange={(e) => setFormData({ ...formData, resumeText: e.target.value })}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white py-4 rounded-xl font-medium transition-all"
          >
            {loading ? "Preparing Interview..." : "Start AI Interview"}
            {!loading && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
