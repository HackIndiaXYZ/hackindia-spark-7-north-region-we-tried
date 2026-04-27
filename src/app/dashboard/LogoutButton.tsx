"use client";

import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 text-sm px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors"
    >
      <LogOut size={14} />
      Logout
    </button>
  );
}
