"use client";

import { motion } from "framer-motion";
import type { Risk } from "@/lib/db/schema";

const COLORS: Record<Risk, { stroke: string; glow: string }> = {
  safe: { stroke: "#34d399", glow: "rgba(52, 211, 153, 0.4)" },
  "on-track": { stroke: "#60a5fa", glow: "rgba(96, 165, 250, 0.4)" },
  "at-risk": { stroke: "#fbbf24", glow: "rgba(251, 191, 36, 0.4)" },
  behind: { stroke: "#fb7185", glow: "rgba(251, 113, 133, 0.4)" },
};

const LABELS: Record<Risk, string> = {
  safe: "Safe",
  "on-track": "On track",
  "at-risk": "At risk",
  behind: "Behind",
};

export function RiskRing({ risk }: { risk: Risk }) {
  const { stroke, glow } = COLORS[risk];
  return (
    <div className="relative h-28 w-28">
      <svg viewBox="0 0 120 120" className="absolute inset-0">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="8"
        />
        <motion.circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke={stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 50}`}
          initial={{ strokeDashoffset: 2 * Math.PI * 50 }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          transform="rotate(-90 60 60)"
          filter="url(#glow)"
        />
        {/* Pulsing dot */}
        <circle cx="60" cy="10" r="4" fill={stroke} className="pulse-dot" />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-fg-muted">
            Status
          </div>
          <div className="text-sm font-semibold mt-0.5" style={{ color: stroke }}>
            {LABELS[risk]}
          </div>
        </div>
      </div>
    </div>
  );
}
