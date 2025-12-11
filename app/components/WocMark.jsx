import React from "react";

export default function WocMark() {
  return (
    <div className="relative">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 via-sky-400 to-purple-500 animate-woc-pulse" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-white">W</span>
      </div>
    </div>
  );
}
