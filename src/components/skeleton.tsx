"use client";

import { motion } from "framer-motion";

interface SkeletonProps {
  className?: string;
  /** Approximate render height in px */
  height?: number;
}

/**
 * Shimmer skeleton — Apple-Health style.
 * Subtle gradient sweep, no spinners.
 */
export function Skeleton({ className = "", height = 16 }: SkeletonProps) {
  return (
    <motion.div
      className={`rounded-lg bg-gradient-to-r from-elev1 via-elev2 to-elev1 bg-[length:200%_100%] ${className}`}
      style={{ height }}
      animate={{ backgroundPosition: ["0% 0%", "200% 0%"] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
    />
  );
}

/**
 * Pre-built skeleton matching dashboard layout.
 * Used while Dexie hydrates on first paint.
 */
export function DashboardSkeleton() {
  return (
    <div className="bg-app min-h-dvh pb-32">
      <header className="px-5 pt-10 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton height={12} className="w-16 mb-2" />
            <Skeleton height={28} className="w-48" />
          </div>
          <div className="text-right">
            <Skeleton height={12} className="w-12 mb-2" />
            <Skeleton height={28} className="w-16" />
          </div>
        </div>
      </header>
      <main className="px-5 max-w-md mx-auto space-y-4">
        <Skeleton height={280} className="w-full rounded-2xl" />
        <Skeleton height={140} className="w-full rounded-2xl" />
        <Skeleton height={120} className="w-full rounded-2xl" />
        <Skeleton height={80} className="w-full rounded-2xl" />
      </main>
    </div>
  );
}
