import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Users, Briefcase, Activity, CheckCircle, Clock } from "lucide-react";
import LogoutButton from "./LogoutButton";
import { ClientDashboardTable } from "./ClientDashboardTable";

export default async function DashboardPage() {
  const sessions = await prisma.interviewSession.findMany({
    include: {
      candidate: true,
      job: true,
      evaluation: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const completed = sessions.filter(s => s.status === "COMPLETED").length;
  const inProgress = sessions.filter(s => s.status === "IN_PROGRESS").length;
  const pending = sessions.filter(s => s.status === "PENDING").length;
  const shortlisted = sessions.filter(s => s.recruiterDecision === "SHORTLISTED").length;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Recruiter Dashboard</h1>
            <p className="text-slate-400 mt-1">Overview of all candidate interviews</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
              Back to Home
            </Link>
            <LogoutButton />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-12">
          {[
            { label: "Total Candidates", value: sessions.length, icon: <Users className="text-blue-400" /> },
            { label: "Completed", value: completed, icon: <CheckCircle className="text-green-400" /> },
            { label: "In Progress", value: inProgress, icon: <Activity className="text-indigo-400" /> },
            { label: "Pending", value: pending, icon: <Clock className="text-amber-400" /> },
            { label: "Shortlisted", value: shortlisted, icon: <Briefcase className="text-purple-400" /> },
          ].map((stat, i) => (
            <div key={i} className="bg-white/5 border border-white/10 p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-400 font-medium">{stat.label}</span>
                {stat.icon}
              </div>
              <p className="text-4xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Candidates List */}
        <ClientDashboardTable sessions={sessions.map(s => ({
          ...s,
          createdAt: s.createdAt.toISOString(),
        }))} />
      </div>
    </div>
  );
}
