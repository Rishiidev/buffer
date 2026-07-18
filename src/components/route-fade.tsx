"use client";

import { type ReactNode } from "react";

/**
 * Page wrapper. Originally used framer-motion AnimatePresence for slide
 * transitions, but the spring physics + mode="wait" caused visible lag
 * and tap-blocking on iOS PWA. Replaced with a plain wrapper for now —
 * iOS users get instant navigation, which is more "native" than a slow
 * slide. Can be reintroduced with mode="popLayout" + lightweight CSS
 * transitions in v2 if desired.
 */
export function RouteFade({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
