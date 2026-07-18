// Lightweight haptics wrapper. Uses iOS Taptic Engine when available via the
// Vibration API fallback; on unsupported platforms, no-ops silently.

type HapticStyle = "light" | "medium" | "heavy" | "success" | "warning" | "error" | "selection";

export function haptic(style: HapticStyle = "light"): void {
  if (typeof window === "undefined") return;

  // 1) iOS Safari PWA: navigator.vibrate is a no-op on iOS but harmless.
  // 2) Android Chrome: navigator.vibrate works.
  try {
    const nav = navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
    if (typeof nav.vibrate === "function") {
      const pattern =
        style === "light" ? 8 :
        style === "medium" ? 15 :
        style === "heavy" ? 25 :
        style === "selection" ? 5 :
        style === "success" ? [10, 50, 10] :
        style === "warning" ? [15, 40, 15] :
        style === "error" ? [25, 60, 25, 60, 25] :
        10;
      nav.vibrate(pattern);
    }
  } catch {
    // no-op
  }
}

// Convenience aliases matching iOS semantics
export const tap = () => haptic("light");
export const impact = (level: "light" | "medium" | "heavy" = "medium") => haptic(level);
export const notify = (kind: "success" | "warning" | "error") => haptic(kind);
