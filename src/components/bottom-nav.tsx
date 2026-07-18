"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, Timer, History, Settings as Cog } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/timer", label: "Timer", icon: Timer },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Cog },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 safe-bottom"
      aria-label="Primary"
    >
      <div className="mx-auto max-w-md px-3 pb-2">
        <div className="card flex items-center justify-around px-1 py-1">
          {TABS.map((tab) => {
            const active =
              pathname === tab.href ||
              (tab.href !== "/" && pathname?.startsWith(tab.href));
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 flex-1 transition-colors",
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
                <span className="relative text-[10px] font-medium tracking-tight">
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
