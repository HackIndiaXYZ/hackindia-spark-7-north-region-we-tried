"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Briefcase, Trash2, ArrowUpDown, Filter, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";

// Minimal type for what we need from the sessions
type DashboardSession = {
  id: string;
  status: string;
  recruiterDecision: string;
  createdAt: string;
  candidate: { name: string; email: string };
  job: { title: string };
  evaluation: { overallScore: number } | null;
};

export function ClientDashboardTable({ sessions }: { sessions: DashboardSession[] }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [dateSort, setDateSort] = useState<"newest" | "oldest">("newest");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Extract unique roles from sessions
  const uniqueRoles = useMemo(() => {
    const roles = Array.from(new Set(sessions.map((s) => s.job.title)));
    return roles.sort();
  }, [sessions]);

  // Filter and sort sessions
  const filteredSessions = useMemo(() => {
    let result = [...sessions];

    // Filter by role
    if (roleFilter !== "ALL") {
      result = result.filter((s) => s.job.title === roleFilter);
    }

    // Filter by date range
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      result = result.filter((s) => new Date(s.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((s) => new Date(s.createdAt) <= to);
    }

    // Sort by date
    result.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateSort === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [sessions, roleFilter, dateSort, dateFrom, dateTo]);

  const toggleAll = () => {
    if (selectedIds.length === filteredSessions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSessions.map((s) => s.id));
    }
  };

  const toggleOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected report(s)?`)) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/dashboard/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      
      setSelectedIds([]);
      router.refresh(); // Refresh the page to get new data
    } catch (err) {
      console.error(err);
      alert("Failed to delete selected reports.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Recent Interviews</h2>
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Sort Button */}
          <button
            onClick={() => setDateSort(dateSort === "newest" ? "oldest" : "newest")}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-white/10 text-sm"
          >
            <ArrowUpDown size={14} />
            {dateSort === "newest" ? "Newest First" : "Oldest First"}
          </button>

          {/* Date Range Picker */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-white/10">
            <Calendar size={14} className="text-slate-400 shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-slate-300 text-sm focus:outline-none w-[120px] [color-scheme:dark]"
              title="From date"
            />
            <span className="text-slate-500 text-xs">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-slate-300 text-sm focus:outline-none w-[120px] [color-scheme:dark]"
              title="To date"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="text-slate-400 hover:text-white text-xs ml-1 transition-colors"
                title="Clear dates"
              >
                ✕
              </button>
            )}
          </div>

          {/* Role Filter Dropdown */}
          <div className="relative flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg border border-white/10">
            <Filter size={14} className="text-slate-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-transparent text-slate-300 text-sm focus:outline-none cursor-pointer appearance-none pr-6"
            >
              <option value="ALL" className="bg-slate-900">All Roles</option>
              {uniqueRoles.map((role) => (
                <option key={role} value={role} className="bg-slate-900">
                  {role}
                </option>
              ))}
            </select>
          </div>

          {/* Delete Button */}
          {selectedIds.length > 0 && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/20 disabled:opacity-50 text-sm"
            >
              <Trash2 size={16} />
              {deleting ? "Deleting..." : `Delete (${selectedIds.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Active filter indicator */}
      {(roleFilter !== "ALL" || dateFrom || dateTo) && (
        <div className="px-6 py-2 bg-indigo-500/10 border-b border-white/10 flex items-center justify-between">
          <span className="text-sm text-indigo-300">
            Showing <strong>{filteredSessions.length}</strong> of {sessions.length}
            {roleFilter !== "ALL" && <> — role: <strong>{roleFilter}</strong></>}
            {dateFrom && <> — from: <strong>{dateFrom}</strong></>}
            {dateTo && <> — to: <strong>{dateTo}</strong></>}
          </span>
          <button
            onClick={() => { setRoleFilter("ALL"); setDateFrom(""); setDateTo(""); }}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Clear All Filters ✕
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-900/50">
            <tr>
              <th className="px-6 py-4 w-12">
                <input
                  type="checkbox"
                  checked={filteredSessions.length > 0 && selectedIds.length === filteredSessions.length}
                  onChange={toggleAll}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500/50"
                />
              </th>
              <th className="px-6 py-4 text-sm font-medium text-slate-400">Candidate</th>
              <th className="px-6 py-4 text-sm font-medium text-slate-400">Role</th>
              <th className="px-6 py-4 text-sm font-medium text-slate-400">Status</th>
              <th className="px-6 py-4 text-sm font-medium text-slate-400">Decision</th>
              <th className="px-6 py-4 text-sm font-medium text-slate-400">Score</th>
              <th className="px-6 py-4 text-sm font-medium text-slate-400">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {filteredSessions.map((session) => (
              <tr key={session.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(session.id)}
                    onChange={() => toggleOne(session.id)}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500/50"
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-white">{session.candidate.name}</div>
                  <div className="text-sm text-slate-400">{session.candidate.email}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-sm">
                    <Briefcase size={14} />
                    {session.job.title}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {session.status === "COMPLETED" && <span className="text-green-400 text-sm font-medium">Completed</span>}
                  {session.status === "IN_PROGRESS" && <span className="text-indigo-400 text-sm font-medium">In Progress</span>}
                  {session.status === "PENDING" && <span className="text-amber-400 text-sm font-medium">Pending</span>}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      session.recruiterDecision === "SHORTLISTED"
                        ? "bg-green-500/20 text-green-300"
                        : session.recruiterDecision === "REJECTED"
                          ? "bg-red-500/20 text-red-300"
                          : session.recruiterDecision === "HOLD"
                            ? "bg-amber-500/20 text-amber-300"
                            : session.recruiterDecision === "PENDING"
                              ? "bg-amber-500/20 text-amber-300" // map pending to hold color visually
                              : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {session.recruiterDecision === "PENDING" ? "HOLD" : session.recruiterDecision}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {session.evaluation ? (
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${
                        session.evaluation.overallScore >= 80 ? "text-green-400" : "text-amber-400"
                      }`}>
                        {session.evaluation.overallScore}
                      </span>
                      <span className="text-slate-500 text-sm">/ 100</span>
                    </div>
                  ) : (
                    <span className="text-slate-500 text-sm">N/A</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <Link 
                    href={`/dashboard/${session.id}`}
                    className="text-indigo-400 hover:text-indigo-300 font-medium text-sm transition-colors"
                  >
                    View Details
                  </Link>
                </td>
              </tr>
            ))}
            {filteredSessions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                  {roleFilter !== "ALL" ? `No interviews found for "${roleFilter}".` : "No interviews found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
