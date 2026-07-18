"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  TrendingDown,
  TrendingUp,
  Clock,
  Target as TargetIcon,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Play,
  CalendarClock,
  Flame,
} from "lucide-react";
import { useData } from "@/lib/hooks/use-data";
import {
  RISK_META,
  runEngine,
  sessionsByDay,
} from "@/lib/engine/predict";
import {
  cn,
  formatHours,
  formatHoursLong,
  formatHMFromSeconds,
} from "@/lib/utils";
import { RiskRing } from "@/components/risk-ring";
import { Heatmap } from "@/components/heatmap";

export default function Dashboard() {
  const data = useData();
  const { activeExam, activeSubjects, examSessions, ready, settings } = data;

  const out = useMemo(() => {
    if (!activeExam) return null;
    return runEngine({ exam: activeExam, sessions: examSessions });
  }, [activeExam, examSessions]);

  const heatmap = useMemo(
    () => sessionsByDay(examSessions, 49),
    [examSessions],
  );

  // Routing gate
  if (!ready) return null;
  if (!settings?.onboardingComplete) {
    if (typeof window !== "undefined") {
      window.location.href = "/onboarding";
    }
    return null;
  }
  if (!activeExam) return null;

  const totalSubjectHours = activeSubjects.reduce(
    (acc, s) => acc + s.estimatedHours,
    0,
  );

  const progressPct =
    out!.requiredHours > 0
      ? Math.min(100, (out!.completedHours / out!.requiredHours) * 100)
      : 0;

  const todayCompleted = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = start.getTime() + 86_400_000;
    return examSessions
      .filter((s) => s.startedAt >= start.getTime() && s.startedAt < end)
      .reduce((acc, s) => acc + s.actualSeconds, 0);
  }, [examSessions]);

  const todayTargetSeconds = Math.round(out!.todayTargetHours * 3600);
  const todayPct = Math.min(
    100,
    (todayCompleted / Math.max(1, todayTargetSeconds)) * 100,
  );

  return (
    <div className="bg-app min-h-dvh pb-32">
      <header className="px-5 pt-10 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-fg-muted">Today</div>
            <h1 className="text-2xl font-display font-semibold tracking-tight mt-0.5">
              {activeExam.name.split(" — ")[0]}
            </h1>
          </div>
          <div className="text-right">
            <div className="text-xs text-fg-muted">Days left</div>
            <div className="text-2xl font-display font-semibold tracking-tight num">
              {out!.daysLeft}
            </div>
          </div>
        </div>
      </header>

      <main className="px-5 max-w-md mx-auto space-y-4">
        {/* Hero: Risk ring + countdown */}
        <section className="card p-6 flex flex-col items-center text-center">
          <RiskRing risk={out!.risk} />
          <div className="mt-4">
            <div className="text-xs uppercase tracking-widest text-fg-muted">
              {RISK_META[out!.risk].label}
            </div>
            <div className="text-4xl font-display font-semibold num mt-1">
              {out!.bufferDays >= 0 ? "+" : ""}
              {out!.bufferDays}
              <span className="text-base text-fg-muted font-medium ml-1">
                days
              </span>
            </div>
            <div className="text-sm text-fg-muted mt-1">
              buffer to exam day
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 w-full">
            <Stat
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="Current"
              value={`${out!.currentPace.toFixed(1)}h`}
              suffix="/day"
            />
            <Stat
              icon={<TargetIcon className="h-3.5 w-3.5" />}
              label="Required"
              value={`${out!.requiredPace.toFixed(1)}h`}
              suffix="/day"
              warn={
                out!.requiredPace > out!.currentPace * 1.2
              }
            />
            <Stat
              icon={<CalendarClock className="h-3.5 w-3.5" />}
              label="Confidence"
              value={`${out!.confidencePct}%`}
            />
          </div>
        </section>

        {/* Today's target */}
        <section className="card p-5">
          <div className="flex items-baseline justify-between mb-2">
            <div>
              <div className="label">Today</div>
              <div className="text-2xl font-display font-semibold num mt-1">
                {formatHMFromSeconds(todayCompleted)}{" "}
                <span className="text-fg-muted text-base font-medium">
                  / {formatHMFromSeconds(todayTargetSeconds)}
                </span>
              </div>
            </div>
            <div
              className={cn(
                "chip",
                todayPct >= 100
                  ? "bg-good/15 text-good"
                  : todayPct >= 50
                    ? "bg-warn/15 text-warn"
                    : "bg-elev-2 text-fg-muted",
              )}
            >
              {todayPct >= 100 ? <CheckCircle2 className="h-3 w-3" /> : null}
              {Math.round(todayPct)}%
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-elev-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${todayPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full",
                todayPct >= 100 ? "bg-good" : "bg-accent",
              )}
            />
          </div>
          <Link
            href="/timer"
            className="btn-primary w-full mt-4"
          >
            <Play className="h-4 w-4" />
            Start a session
          </Link>
        </section>

        {/* Progress: completed vs required */}
        <section className="card p-5">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="label">Syllabus progress</div>
              <div className="text-3xl font-display font-semibold num mt-1">
                {formatHours(out!.completedHours)}
                <span className="text-fg-muted text-lg font-medium">
                  {" / "}
                  {formatHours(out!.requiredHours)}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-fg-muted">Remaining</div>
              <div className="text-lg font-display font-semibold num">
                {formatHours(out!.remainingHours)}
              </div>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-elev-2 overflow-hidden mt-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full bg-accent rounded-full"
            />
          </div>
          <div className="flex justify-between text-xs text-fg-muted mt-2">
            <span className="num">{Math.round(progressPct)}% complete</span>
            <span>{out!.daysLeft} days left</span>
          </div>
        </section>

        {/* Recommendations */}
        <section className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-accent" />
            <div className="label">Today's read</div>
          </div>
          <div className="space-y-2">
            {out!.recommendations.map((rec, i) => (
              <div key={i} className="flex gap-3">
                <div className="h-1.5 w-1.5 rounded-full bg-accent mt-2 shrink-0" />
                <p className="text-sm leading-relaxed">{rec}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Streak + Behind */}
        <section className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<Flame className="h-4 w-4" />}
            label="Streak"
            value={`${out!.streakDays}d`}
            accent={out!.streakDays >= 7 ? "good" : undefined}
          />
          <StatCard
            icon={
              out!.behindHours > 0 ? (
                <TrendingDown className="h-4 w-4" />
              ) : (
                <TrendingUp className="h-4 w-4" />
              )
            }
            label={out!.behindHours > 0 ? "Behind" : "Ahead"}
            value={`${Math.abs(out!.behindHours)}h`}
            accent={out!.behindHours > 0 ? "bad" : "good"}
          />
        </section>

        {/* Heatmap */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="label">Last 7 weeks</div>
            <div className="text-xs text-fg-muted num">
              {formatHours(
                heatmap.reduce((acc, d) => acc + d.hours, 0),
              )}{" "}
              total
            </div>
          </div>
          <Heatmap data={heatmap} />
        </section>

        {/* Subject progress */}
        {activeSubjects.length > 0 && (
          <section className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="label">Subjects</div>
              <div className="text-xs text-fg-muted num">
                {formatHours(totalSubjectHours)} budgeted
              </div>
            </div>
            <div className="space-y-3">
              {activeSubjects.map((s) => {
                const subjectSessions = examSessions.filter(
                  (x) => x.subjectId === s.id,
                );
                const done = subjectSessions.reduce(
                  (acc, x) => acc + x.actualSeconds,
                  0,
                );
                const doneHrs = done / 3600;
                const pct =
                  s.estimatedHours > 0
                    ? Math.min(100, (doneHrs / s.estimatedHours) * 100)
                    : 0;
                return (
                  <div key={s.id}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ background: s.color }}
                        />
                        <span className="font-medium">{s.name}</span>
                      </div>
                      <div className="text-fg-muted num text-xs">
                        {formatHours(doneHrs)} / {formatHours(s.estimatedHours)}
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-elev-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: s.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty-state nudges */}
        {examSessions.length === 0 && (
          <section className="card p-5 border-accent/30">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-accent-soft grid place-items-center shrink-0">
                <AlertTriangle className="h-4 w-4 text-accent" />
              </div>
              <div>
                <div className="font-medium">No sessions yet</div>
                <p className="text-sm text-fg-muted mt-1">
                  Start your first session to see the dashboard light up. Until
                  then, your "pace" is a guess.
                </p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  suffix,
  warn,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  warn?: boolean;
}) {
  return (
    <div className="bg-elev-2 rounded-xl py-3 px-2">
      <div className="flex items-center justify-center gap-1 text-fg-muted">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div
        className={cn(
          "text-lg font-display font-semibold num mt-1",
          warn ? "text-warn" : "text-fg",
        )}
      >
        {value}
        {suffix && (
          <span className="text-xs text-fg-muted font-medium ml-0.5">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: "good" | "bad" | "warn";
}) {
  const colors = {
    good: "text-good bg-good/10",
    bad: "text-bad bg-bad/10",
    warn: "text-warn bg-warn/10",
  } as const;
  return (
    <div className="card p-4 flex items-center gap-3">
      <div
        className={cn(
          "h-9 w-9 rounded-lg grid place-items-center",
          accent ? colors[accent] : "bg-elev-2 text-fg-muted",
        )}
      >
        {icon}
      </div>
      <div>
        <div className="text-xs text-fg-muted">{label}</div>
        <div className="text-lg font-display font-semibold num">{value}</div>
      </div>
    </div>
  );
}
