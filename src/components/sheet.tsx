"use client";

import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { useEffect, type ReactNode } from "react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /**
   * If true, sheet can be dismissed by dragging down.
   * Default true. Pass false to lock (e.g. for in-progress forms).
   */
  dismissible?: boolean;
}

/**
 * iOS-style bottom sheet.
 * - Drag handle at top
 * - Drag down to dismiss (rubber-band on small overscroll)
 * - Snap to fully open or fully closed
 * - Spring physics tuned to iOS feel
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  dismissible = true,
}: SheetProps) {
  const y = useMotionValue(0);
  // Fade backdrop as user drags
  const opacity = useTransform(y, [0, 300], [1, 0]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const shouldClose =
      info.offset.y > 120 || (info.offset.y > 40 && info.velocity.y > 500);
    if (shouldClose && dismissible) {
      onClose();
    } else {
      y.set(0);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: open ? 1 : 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        style={{ opacity }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        drag={dismissible ? "y" : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={handleDragEnd}
        style={{ y }}
        initial={{ y: "100%" }}
        animate={{ y: open ? 0 : "100%" }}
        exit={{ y: "100%" }}
        transition={{
          type: "spring",
          damping: 32,
          stiffness: 320,
          mass: 0.9,
        }}
        className="fixed inset-x-0 bottom-0 z-50 bg-elev1 rounded-t-3xl border-t border-border-soft max-h-[88vh] overflow-y-auto safe-bottom touch-none"
      >
        <div className="sticky top-0 bg-elev1/95 backdrop-blur-md pt-3 pb-2 z-10">
          <div className="w-10 h-1 bg-border rounded-full mx-auto" />
          {title && (
            <div className="text-lg font-display font-semibold tracking-tight mt-3 px-5">
              {title}
            </div>
          )}
        </div>
        <div className="px-5 pb-8">{children}</div>
      </motion.div>
    </>
  );
}
