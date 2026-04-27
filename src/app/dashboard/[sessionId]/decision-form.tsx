"use client";

import { useState } from "react";

type Decision = "SHORTLISTED" | "REJECTED" | "HOLD";

export function DecisionForm({
  sessionId,
  initialDecision,
  initialNotes,
}: {
  sessionId: string;
  initialDecision: Decision | "PENDING";
  initialNotes: string | null;
}) {
  const [decision, setDecision] = useState<Decision>(
    initialDecision === "PENDING" ? "HOLD" : initialDecision as Decision
  );
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const onSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/dashboard/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          recruiterDecision: decision,
          recruiterNotes: notes,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to save recruiter decision");
      }
      setMessage("Saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
      <h3 className="font-semibold text-lg mb-4">Recruiter Decision</h3>
      <div className="space-y-4">
        <select
          value={decision}
          onChange={(e) => setDecision(e.target.value as Decision)}
          className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="SHORTLISTED">Shortlisted</option>
          <option value="HOLD">Hold</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Add recruiter notes..."
          className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Decision"}
          </button>
          {message && <span className="text-sm text-slate-300">{message}</span>}
        </div>
      </div>
    </div>
  );
}
