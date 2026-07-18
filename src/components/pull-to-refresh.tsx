"use client";

import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { haptic } from "@/lib/haptics";

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
}

/**
 * iOS-style pull-to-refresh.
 * - Pull down past 80px → triggers refresh with haptic + spinner
 * - Rubber-bands on over-pull
 * - Does NOT consume scroll on horizontal swipes (axis-locked)
 */
export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const y = useMotionValue(0);
  const [refreshing, setRefreshing] = useState(false);
  const rotation = useTransform(y, [0, 100], [0, 360]);
  const opacity = useTransform(y, [0, 40, 80], [0, 0.4, 1]);
  const scale = useTransform(y, [0, 100], [0.5, 1]);

  const handleDragEnd = async (_: unknown, info: PanInfo) => {
    if (refreshing) return;
    if (y.get() > 80 || (y.get() > 40 && info.velocity.y > 500)) {
      setRefreshing(true);
      haptic("medium");
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        y.set(0);
      }
    } else {
      y.set(0);
    }
  };

  return (
    <div className="relative">
      <motion.div
        style={{ opacity, scale, rotate: rotation }}
        className="absolute left-1/2 -translate-x-1/2 top-2 z-10 pointer-events-none"
      >
        <div className="h-9 w-9 rounded-full bg-elev2 border border-border-soft grid place-items-center">
          <RefreshCw
            className={`h-4 w-4 text-accent ${refreshing ? "animate-spin" : ""}`}
          />
        </div>
      </motion.div>
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.5, bottom: 0 }}
        onDragEnd={handleDragEnd}
        style={{ y }}
        className="touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
}
