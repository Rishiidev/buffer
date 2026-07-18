"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/button";
import { Sheet } from "@/components/sheet";
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Coffee,
  Brain,
  ChevronDown,
  Plus,
  Timer as TimerIcon,
  Check,
} from "lucide-react";
import { useTimer, type TimerMode } from "@/lib/stores/timer";
import { useData } from "@/lib/hooks/use-data";
import { toast } from "sonner";
import { haptic, notify } from "@/lib/haptics";
import {
  cn,
  formatClockFromSeconds,
  uid,
} from "@/lib/utils";

const MODES: Array<{
  id: TimerMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    id: "pomodoro",
    label: "Pomodoro",
    description: "25 min focus, 5 min break",
    icon: <Brain className="h-4 w-4" />,
  },
  {
    id: "custom",
    label: "Custom",
    description: "Set your own focus length",
    icon: <TimerIcon className="h-4 w-4" />,
  },
  {
    id: "countdown",
    label: "Countdown",
    description: "Race a fixed target",
    icon: <TimerIcon className="h-4 w-4" />,
  },
  {
    id: "stopwatch",
    label: "Stopwatch",
    description: "Log freely",
    icon: <TimerIcon className="h-4 w-4" />,
  },
];

export default function TimerPage() {
  const data = useData();
  const timer = useTimer();
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(45);
  const [countdownMinutes, setCountdownMinutes] = useState(60);
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [notes, setNotes] = useState("");
  const [showEndSheet, setShowEndSheet] = useState(false);
  const [pendingEnd, setPendingEnd] = useState<{
    seconds: number;
    type: TimerMode;
    pomodoros: number;
  } | null>(null);

  const tickRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const wakeLockRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const subject = useMemo(
    () => data.activeSubjects.find((s) => s.id === timer.subjectId) ?? null,
    [data.activeSubjects, timer.subjectId],
  );

  // --- Tick loop ---
  useEffect(() => {
    if (timer.id && timer.status === "running") {
      lastTickRef.current = Date.now();
      tickRef.current = window.setInterval(() => {
        const now = Date.now();
        const delta = (now - lastTickRef.current) / 1000;
        lastTickRef.current = now;
        timer.tick(delta);

        // Auto phase change for pomodoro
        const state = useTimer.getState();
        if (state.mode === "pomodoro") {
          if (
            state.phase === "focus" &&
            state.phasePlanned > 0 &&
            state.phaseElapsed >= state.phasePlanned
          ) {
            // phase done
            playChime("end");
            const focusMin = data.settings?.pomodoroFocusMin ?? 25;
            const shortBreakMin = data.settings?.pomodoroShortBreakMin ?? 5;
            const longBreakMin = data.settings?.pomodoroLongBreakMin ?? 15;
            const before = data.settings?.pomodorosBeforeLongBreak ?? 4;
            const newPomos = state.pomodorosCompleted + 1;
            const isLong = newPomos % before === 0;
            state.incrementPomodoro();
            state.switchPhase("short-break", isLong ? longBreakMin * 60 : shortBreakMin * 60);
            toast.success(
              isLong
                ? "Take a long break — 15 min"
                : "Break time — 5 min",
              { description: "Timer paused. Resume when ready." },
            );
            notify("success");
            state.pause();
          } else if (
            (state.phase === "short-break" || state.phase === "long-break") &&
            state.phasePlanned > 0 &&
            state.phaseElapsed >= state.phasePlanned
          ) {
            playChime("end");
            const focusMin = data.settings?.pomodoroFocusMin ?? 25;
            state.switchPhase("focus", focusMin * 60);
            toast("Back to focus", {
              description: "Tap resume when ready.",
            });
            haptic("medium");
            state.pause();
          }
        } else if (state.mode === "countdown") {
          if (
            state.targetSeconds > 0 &&
            state.totalElapsed >= state.targetSeconds
          ) {
            playChime("end");
            notify("success");
            handleStop(true);
          }
        }
      }, 250);
    }
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [timer.id, timer.status, data.settings]);

  // --- Wake lock + visibility ---
  useEffect(() => {
    const acquire = async () => {
      try {
        if ("wakeLock" in navigator && timer.id && timer.status === "running") {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        }
      } catch {}
    };
    const release = async () => {
      try {
        if (wakeLockRef.current) {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
        }
      } catch {}
    };
    if (timer.id && timer.status === "running") {
      acquire();
      document.addEventListener("visibilitychange", acquire);
    } else {
      release();
      document.removeEventListener("visibilitychange", acquire);
    }
    return () => {
      release();
      document.removeEventListener("visibilitychange", acquire);
    };
  }, [timer.id, timer.status]);

  const playChime = (kind: "start" | "end") => {
    if (!data.settings?.soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current!;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = kind === "start" ? 660 : 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + (kind === "end" ? 0.6 : 0.2),
      );
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (kind === "end" ? 0.6 : 0.2));
      if (kind === "end") {
        setTimeout(() => {
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.frequency.value = 660;
          o2.type = "sine";
          g2.gain.setValueAtTime(0.0001, ctx.currentTime);
          g2.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
          g2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
          o2.connect(g2).connect(ctx.destination);
          o2.start();
          o2.stop(ctx.currentTime + 0.6);
        }, 200);
      }
    } catch {}
  };

  // --- Start / stop ---
  const start = (subjectId: string) => {
    if (!data.activeExam) {
      toast.error("Set up an exam first");
      return;
    }
    setShowSubjectPicker(false);
    const mode = useTimer.getState().mode;
    let phase: any = "focus";
    let phasePlanned = 0;
    let targetSeconds = 0;
    if (mode === "pomodoro") {
      phase = "focus";
      phasePlanned = (data.settings?.pomodoroFocusMin ?? 25) * 60;
    } else if (mode === "custom") {
      phasePlanned = customMinutes * 60;
    } else if (mode === "countdown") {
      phasePlanned = countdownMinutes * 60;
      targetSeconds = countdownMinutes * 60;
    }
    timer.start({
      id: uid(),
      examId: data.activeExam.id,
      subjectId,
      mode,
      phase,
      phasePlanned,
      targetSeconds,
    });
    playChime("start");
  };

  const pause = () => {
    timer.pause();
  };
  const resume = () => {
    timer.resume();
    playChime("start");
  };
  const handleStop = (autoEnd = false) => {
    const state = useTimer.getState();
    if (!state.id || !state.subjectId || !state.examId) {
      timer.stop();
      return;
    }
    const totalSec = Math.round(state.totalElapsed);
    if (totalSec < 5) {
      timer.stop();
      toast("Session too short", { description: "Less than 5 seconds — discarded." });
      return;
    }
    const completedPhaseSec =
      state.phase === "focus" || state.mode === "stopwatch" || state.mode === "countdown"
        ? totalSec
        : Math.max(0, totalSec); // for pomodoro we still log actualSeconds = totalSec, but only the focus phases count
    setPendingEnd({
      seconds:
        state.mode === "pomodoro"
          ? // For pomodoro, count only the focus phases (rough)
            Math.max(0, totalSec - Math.round(state.pomodorosCompleted * 5 * 60))
          : totalSec,
      type: state.mode,
      pomodoros: state.pomodorosCompleted,
    });
    setShowEndSheet(true);
    timer.stop();
  };

  const saveSession = async () => {
    if (!pendingEnd) return;
    await data.addSession({
      examId: data.activeExam!.id,
      subjectId: useTimer.getState().subjectId!,
      startedAt: useTimer.getState().startedAt,
      endedAt: Date.now(),
      plannedSeconds: Math.round(
        pendingEnd.type === "countdown"
          ? pendingEnd.seconds
          : 0,
      ),
      actualSeconds: pendingEnd.seconds,
      type: pendingEnd.type,
      rating: rating ?? undefined,
      notes: notes.trim() || undefined,
      pomodorosCompleted: pendingEnd.pomodoros || undefined,
    });
    toast.success("Session saved");
    setShowEndSheet(false);
    setPendingEnd(null);
    setRating(null);
    setNotes("");
  };

  const discard = () => {
    setShowEndSheet(false);
    setPendingEnd(null);
    setRating(null);
    setNotes("");
    toast("Session discarded");
  };

  // Routing guard
  if (!data.ready) return null;
  if (!data.activeExam) {
    return (
      <div className="bg-app min-h-dvh flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-display font-semibold mb-2">No exam yet</h2>
          <p className="text-fg-muted text-sm">
            Set up an exam to start timing sessions.
          </p>
        </div>
      </div>
    );
  }

  const displaySeconds =
    timer.mode === "pomodoro"
      ? Math.max(0, timer.phasePlanned - timer.phaseElapsed)
      : timer.mode === "countdown"
        ? Math.max(0, timer.targetSeconds - timer.totalElapsed)
        : timer.totalElapsed;

  const progressPct =
    timer.mode === "pomodoro" && timer.phasePlanned > 0
      ? (timer.phaseElapsed / timer.phasePlanned) * 100
      : timer.mode === "countdown" && timer.targetSeconds > 0
        ? (timer.totalElapsed / timer.targetSeconds) * 100
        : 0;

  return (
    <div className="bg-app min-h-dvh pb-32 flex flex-col">
      <header className="px-5 pt-10 pb-2">
        <h1 className="text-2xl font-display font-semibold tracking-tight">
          {timer.id ? "In session" : "Start a session"}
        </h1>
        <p className="text-sm text-fg-muted mt-1">
          {timer.id
            ? timer.status === "paused"
              ? "Paused — tap resume to continue."
              : "Stay with it."
            : "Pick a subject, set a duration, hit start."}
        </p>
      </header>

      <main className="flex-1 px-5 max-w-md w-full mx-auto flex flex-col">
        {/* Idle: setup */}
        {!timer.id && (
          <div className="space-y-4 mt-4">
            {/* Mode picker */}
            <div className="card p-3">
              <div className="label mb-2">Mode</div>
              <div className="grid grid-cols-2 gap-2">
                {MODES.map((m) => {
                  const active = useTimer.getState().mode === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        timer.stop();
                        useTimer.setState({ mode: m.id });
                      }}
                      className={cn(
                        "rounded-xl p-3 text-left transition-all border",
                        active
                          ? "border-accent bg-accent/10"
                          : "border-border-soft bg-elev2 hover:bg-elev2/70",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "h-7 w-7 rounded-lg grid place-items-center",
                            active ? "bg-accent text-black" : "bg-elev1 text-fg-muted",
                          )}
                        >
                          {m.icon}
                        </div>
                        <div className="text-sm font-medium">{m.label}</div>
                      </div>
                      <div className="text-xs text-fg-muted mt-1.5">
                        {m.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mode-specific config */}
            {timer.mode === "custom" && (
              <div className="card p-5">
                <div className="label mb-2">Focus length</div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={5}
                    max={180}
                    step={5}
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(Number(e.target.value))}
                    className="flex-1 accent-accent"
                  />
                  <div className="text-2xl font-display font-semibold num w-20 text-right">
                    {customMinutes}m
                  </div>
                </div>
              </div>
            )}
            {timer.mode === "countdown" && (
              <div className="card p-5">
                <div className="label mb-2">Target</div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={10}
                    max={240}
                    step={5}
                    value={countdownMinutes}
                    onChange={(e) => setCountdownMinutes(Number(e.target.value))}
                    className="flex-1 accent-accent"
                  />
                  <div className="text-2xl font-display font-semibold num w-20 text-right">
                    {countdownMinutes}m
                  </div>
                </div>
              </div>
            )}

            {/* Subject picker */}
            <button
              onClick={() => setShowSubjectPicker(true)}
              className="card-interactive w-full p-4 flex items-center justify-between"
            >
              <div>
                <div className="label">Subject</div>
                {subject ? (
                  <div className="text-base font-medium mt-0.5 flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: subject.color }}
                    />
                    {subject.name}
                  </div>
                ) : (
                  <div className="text-base font-medium mt-0.5 text-fg-muted">
                    Tap to choose
                  </div>
                )}
              </div>
              <ChevronDown className="h-5 w-5 text-fg-muted" />
            </button>

            {subject && (
              <button
                onClick={() => start(subject.id)}
                className="btn-primary w-full py-4 text-base"
              >
                <Play className="h-5 w-5" />
                Start
              </button>
            )}
          </div>
        )}

        {/* Active session */}
        {timer.id && (
          <div className="flex-1 flex flex-col items-center justify-center text-center mt-8">
            {subject && (
              <div className="flex items-center gap-2 mb-6">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: subject.color }}
                />
                <span className="text-sm text-fg-muted">{subject.name}</span>
              </div>
            )}

            {timer.mode === "pomodoro" && (
              <div className="chip bg-elev2 mb-6">
                {timer.phase === "focus" ? (
                  <>
                    <Brain className="h-3 w-3 text-accent" />
                    Focus
                  </>
                ) : (
                  <>
                    <Coffee className="h-3 w-3 text-good" />
                    {timer.phase === "long-break" ? "Long break" : "Break"}
                  </>
                )}
                {timer.pomodorosCompleted > 0 && (
                  <span className="text-fg-muted ml-1">
                    · {timer.pomodorosCompleted} done
                  </span>
                )}
              </div>
            )}

            {/* Big circular display */}
            <div className="relative h-72 w-72 grid place-items-center">
              <svg viewBox="0 0 200 200" className="absolute inset-0">
                <circle
                  cx="100"
                  cy="100"
                  r="92"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="6"
                />
                {progressPct > 0 && (
                  <motion.circle
                    cx="100"
                    cy="100"
                    r="92"
                    fill="none"
                    stroke={timer.phase === "focus" || timer.mode === "stopwatch" || timer.mode === "countdown" ? "#ff6b35" : "#34d399"}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 92}`}
                    initial={false}
                    animate={{
                      strokeDashoffset:
                        2 * Math.PI * 92 * (1 - progressPct / 100),
                    }}
                    transition={{ duration: 0.3, ease: "linear" }}
                    transform="rotate(-90 100 100)"
                  />
                )}
              </svg>
              <div className="text-center">
                <div className="text-display-xl font-display num tabular-nums tracking-tight">
                  {formatClockFromSeconds(displaySeconds)}
                </div>
                <div className="text-sm text-fg-muted mt-1 num">
                  {timer.status === "paused" ? "Paused" : "Elapsed " + formatClockFromSeconds(Math.round(timer.totalElapsed))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-10">
              {timer.status === "running" ? (
                <button
                  onClick={pause}
                  className="btn-ghost h-14 w-14 rounded-full p-0"
                  aria-label="Pause"
                >
                  <Pause className="h-6 w-6" />
                </button>
              ) : (
                <button
                  onClick={resume}
                  className="btn-primary h-14 w-14 rounded-full p-0"
                  aria-label="Resume"
                >
                  <Play className="h-6 w-6" />
                </button>
              )}
              <button
                onClick={() => handleStop()}
                className="btn-ghost h-14 w-14 rounded-full p-0"
                aria-label="End"
              >
                <Square className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  timer.reset();
                }}
                className="btn-ghost h-14 w-14 rounded-full p-0"
                aria-label="Reset"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Subject picker sheet */}
      <Sheet
        open={showSubjectPicker}
        onClose={() => setShowSubjectPicker(false)}
        title="Pick subject"
      >
        <div className="space-y-2">
          {data.activeSubjects.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                haptic("selection");
                timer.stop();
                useTimer.setState({ subjectId: s.id });
                setShowSubjectPicker(false);
              }}
              className="card-interactive w-full p-4 flex items-center gap-3 min-h-[56px]"
            >
              <div
                className="h-3 w-3 rounded-full"
                style={{ background: s.color }}
              />
              <div className="flex-1 text-left">
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-fg-muted">
                  {s.estimatedHours}h budget
                </div>
              </div>
              {timer.subjectId === s.id && (
                <Check className="h-4 w-4 text-accent" />
              )}
            </button>
          ))}
          <Link
            href="/settings"
            onClick={() => setShowSubjectPicker(false)}
            className="btn-outline w-full mt-2"
          >
            <Plus className="h-4 w-4" />
            Manage subjects
          </Link>
        </div>
      </Sheet>

      {/* End-of-session sheet */}
      <Sheet
        open={showEndSheet && !!pendingEnd}
        onClose={() => setShowEndSheet(false)}
        title="How did it go?"
      >
        {pendingEnd && (
          <div className="space-y-4">
            <div className="card p-4 text-center">
              <div className="text-3xl font-display font-semibold num">
                {Math.round(pendingEnd.seconds / 60)}m
              </div>
              <div className="text-xs text-fg-muted mt-1">
                logged
              </div>
              {pendingEnd.pomodoros > 0 && (
                <div className="text-xs text-fg-muted mt-2">
                  {pendingEnd.pomodoros} pomodoro
                  {pendingEnd.pomodoros === 1 ? "" : "s"} completed
                </div>
              )}
            </div>

            <div>
              <div className="label mb-2">Focus quality</div>
              <div className="flex justify-between gap-2">
                {[1, 2, 3, 4, 5].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRating(r as any)}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-sm font-medium transition-colors",
                      rating === r
                        ? "bg-accent text-black"
                        : "bg-elev2 text-fg-muted hover:bg-elev2/70",
                    )}
                  >
                    {"★".repeat(r)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="label mb-2">Notes (optional)</div>
              <textarea
                className="field min-h-[80px] resize-none"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did you cover?"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button onClick={discard} className="btn-ghost">
                Discard
              </button>
              <button onClick={saveSession} className="btn-primary">
                Save
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
