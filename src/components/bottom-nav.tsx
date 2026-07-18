"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, Timer, History, Settings as Cog, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/timer", label: "Timer", icon: Timer },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Cog },
];

export function BottomNav() {
  const pathname = usePathname();
  // Hide during onboarding — it has its own fixed CTA footer.
  if (pathname === "/onboarding") return null;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40"
      aria-label="Primary"
    >
      {/* Opaque solid bar — no blur, no transparency. The Card-style container
          provides the iOS-tab-bar floating feel, the surrounding wrapper has
          a solid bg so content above can never bleed through. */}
      <div className="bg-bg border-t border-border-soft safe-bottom">
        <div className="mx-auto max-w-md px-3 pt-2 pb-2">
          <div className="bg-elev1 border border-border-soft rounded-2xl flex items-center justify-around px-1 py-1 shadow-[0_-2px_20px_rgba(0,0,0,0.4)]">
            {TABS.map((tab) => {
              const active =
                pathname === tab.href ||
                (tab.href !== "/" && pathname?.startsWith(tab.href));
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  prefetch={false}
                  className={cn(
                    "relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 flex-1 min-h-[48px] transition-colors active:scale-95",
                    active ? "text-fg" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="active-tab"
                      className="absolute inset-0 rounded-xl bg-elev2"
                      transition={{ type: "spring", duration: 0.4, bounce: 0.18 }}
                    />
                  )}
                  <Icon className="relative h-5 w-5" strokeWidth={1.75} />
                  <span className="relative text-[11px] font-medium tracking-tight">
                    {tab.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
