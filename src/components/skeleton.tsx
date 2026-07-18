"use client";

import { motion } from "framer-motion";

interface SkeletonProps {
  className?: string;
  /** Approximate render height in px */
  height?: number;
  width?: string | number;
}

/**
 * Shimmer skeleton — Apple-Health style.
 * Subtle gradient sweep, no spinners.
 */
export function Skeleton({
  className = "",
  height = 16,
  width = "100%",
}: SkeletonProps) {
  return (
    <motion.div
      className={`rounded-lg bg-gradient-to-r from-elev2 via-elev1 to-elev2 bg-[length:200%_100%] ${className}`}
      style={{ height, width }}
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
    <div className="bg-app min-h-dvh pb-40">
      <header className="px-5 pt-10 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton height={12} width={64} className="mb-2" />
            <Skeleton height={28} width={192} />
          </div>
          <div className="text-right">
            <Skeleton height={12} width={48} className="mb-2" />
            <Skeleton height={28} width={64} />
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

/** Skeleton for the Timer page idle (setup) state. */
export function TimerIdleSkeleton() {
  return (
    <div className="bg-app min-h-dvh pb-40">
      <header className="px-5 pt-10 pb-2">
        <Skeleton height={28} width={160} className="mb-2" />
        <Skeleton height={14} width={240} />
      </header>
      <main className="px-5 max-w-md mx-auto space-y-4 mt-4">
        <div className="card p-3 space-y-2">
          <Skeleton height={12} width={40} className="mb-2" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton height={88} className="rounded-xl" />
            <Skeleton height={88} className="rounded-xl" />
            <Skeleton height={88} className="rounded-xl" />
            <Skeleton height={88} className="rounded-xl" />
          </div>
        </div>
        <Skeleton height={120} className="w-full rounded-2xl" />
        <Skeleton height={64} className="w-full rounded-2xl" />
      </main>
    </div>
  );
}

/** Skeleton for the History page. */
export function HistorySkeleton() {
  return (
    <div className="bg-app min-h-dvh pb-40">
      <header className="px-5 pt-10 pb-2">
        <div className="flex items-baseline justify-between">
          <Skeleton height={28} width={96} />
          <div className="text-right">
            <Skeleton height={10} width={64} className="mb-1" />
            <Skeleton height={20} width={64} />
          </div>
        </div>
      </header>
      <main className="px-5 max-w-md mx-auto space-y-4 mt-4">
        <Skeleton height={44} className="w-full rounded-2xl" />
        <div className="flex gap-2">
          <Skeleton height={28} width={56} className="rounded-full" />
          <Skeleton height={28} width={80} className="rounded-full" />
          <Skeleton height={28} width={64} className="rounded-full" />
          <Skeleton height={28} width={72} className="rounded-full" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={64} className="w-full rounded-2xl" />
          ))}
        </div>
      </main>
    </div>
  );
}

/** Skeleton for the Settings page. */
export function SettingsSkeleton() {
  return (
    <div className="bg-app min-h-dvh pb-40">
      <header className="px-5 pt-10 pb-2">
        <Skeleton height={28} width={120} />
      </header>
      <main className="px-5 max-w-md mx-auto space-y-5 mt-4">
        <div>
          <Skeleton height={12} width={48} className="mb-2" />
          <Skeleton height={120} className="w-full rounded-2xl" />
        </div>
        <div>
          <Skeleton height={12} width={72} className="mb-2" />
          <div className="space-y-2">
            <Skeleton height={48} className="w-full rounded-2xl" />
            <Skeleton height={48} className="w-full rounded-2xl" />
          </div>
        </div>
        <div>
          <Skeleton height={12} width={80} className="mb-2" />
          <Skeleton height={180} className="w-full rounded-2xl" />
        </div>
      </main>
    </div>
  );
}
