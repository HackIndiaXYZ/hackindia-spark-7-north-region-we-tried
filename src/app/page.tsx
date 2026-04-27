"use client";

import { motion } from "framer-motion";
import { ArrowRight, BrainCircuit, Code, Users } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute inset-0 -z-10 bg-slate-950">
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3">
          <div className="h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px]" />
        </div>
        <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3">
          <div className="h-[600px] w-[600px] rounded-full bg-blue-600/20 blur-[120px]" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="container mx-auto px-6 py-6 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-8 h-8 text-indigo-400" />
          <span className="text-xl font-bold tracking-tight text-white">AICRUITER</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/test-llm" className="text-sm font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
            Test API
          </Link>
          <Link href="/login" className="text-sm text-slate-300 hover:text-white transition-colors">
            Recruiter Login
          </Link>
          <Link
            href="/apply"
            className="text-sm font-medium bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-full backdrop-blur-md transition-all border border-white/10"
          >
            Apply Now
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="container mx-auto px-6 pt-32 pb-24 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium mb-8">
              <span className="flex w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              Next-Gen Hiring Platform
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-6xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 mb-8"
          >
            Hire the Top 1% with <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400">
              Automated AI Interviews
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            Scale your recruitment process with intelligent conversational AI. 
            Assess technical skills, communication, and culture fit automatically.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/apply"
              className="group flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-4 rounded-full font-medium transition-all shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)]"
            >
              I'm a Candidate
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-8 py-4 rounded-full font-medium transition-all border border-white/10 backdrop-blur-md"
            >
              I'm a Recruiter
            </Link>
          </motion.div>
        </div>

        {/* Feature Cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="grid md:grid-cols-3 gap-6 mt-32 max-w-5xl mx-auto"
        >
          {[
            {
              icon: <BrainCircuit className="w-6 h-6 text-indigo-400" />,
              title: "Adaptive AI Questions",
              desc: "Dynamic questions that adapt to candidate's previous answers."
            },
            {
              icon: <Code className="w-6 h-6 text-blue-400" />,
              title: "Technical Assessment",
              desc: "Real-time evaluation of problem-solving and coding skills."
            },
            {
              icon: <Users className="w-6 h-6 text-purple-400" />,
              title: "Unbiased Scoring",
              desc: "Objective evaluation metrics to find the absolute best talent."
            }
          ].map((feature, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/[0.07] transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-900/50 flex items-center justify-center border border-white/5 mb-4">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-slate-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
