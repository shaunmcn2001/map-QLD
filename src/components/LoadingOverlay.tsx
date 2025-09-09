import React from "react";

export default function LoadingOverlay({ show, label = "Working…" }: { show: boolean; label?: string }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 backdrop-blur-sm">
      <div className="rounded-xl bg-white px-6 py-4 shadow">
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
          <span className="font-medium">{label}</span>
        </div>
      </div>
    </div>
  );
}
