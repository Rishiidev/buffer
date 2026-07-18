"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const HIDE_ON = new Set<string>(["/onboarding"]);

export function PwaInstaller() {
  const pathname = usePathname();
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    if (window.localStorage.getItem("buffer-pwa-dismissed") === "1") {
      setDismissed(true);
    }
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Hide on routes that have their own persistent fixed bottom CTAs to
  // avoid visually stacking the install banner over onboarding / modals.
  if (pathname && HIDE_ON.has(pathname)) return null;
  if (!evt || dismissed) return null;

  const install = async () => {
    await evt.prompt();
    await evt.userChoice;
    setEvt(null);
  };

  const dismiss = () => {
    window.localStorage.setItem("buffer-pwa-dismissed", "1");
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 safe-bottom">
      <div className="mx-auto max-w-md card flex items-center gap-3 p-3 shadow-2xl">
        <div className="flex-1">
          <div className="text-sm font-medium">Add to Home Screen</div>
          <div className="text-xs text-fg-muted">
            Install Buffer for one-tap study sessions.
          </div>
        </div>
        <button onClick={install} className="btn-primary py-2 px-4">
          <Download className="h-4 w-4" />
          Install
        </button>
        <button
          onClick={dismiss}
          className="text-fg-muted hover:text-fg p-1"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
