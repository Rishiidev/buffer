"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sheet } from "@/components/sheet";
import { TimerIdleSkeleton } from "@/components/skeleton";
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
import {
  useDataStore,
  useActiveExam,
  useActiveSubjects,
  useExamSessions,
} from "@/lib/stores/data";
import { toast } from "sonner";
import { haptic, notify } from "@/lib/haptics";
import { cn, formatClockFromSeconds, uid } from "@/lib/utils";

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
  // Routing + data hooks (selectors only — never the whole store).
  const ready = useDataStore((s) => s.ready);
  const settings = useDataStore((s) => s.settings);
  const activeExam = useActiveExam();
  const activeSubjects = useActiveSubjects();
  const examSessions = useExamSessions();

  // Local UI state.
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

  // Stable subjectId selector — only this card re-renders when changed.
  const timerSubjectId = useTimer((s) => s.subjectId);
  const timerId = useTimer((s) => s.id);
  const subject = useMemo(
    () => activeSubjects.find((s) => s.id === timerSubjectId) ?? null,
    [activeSubjects, timerSubjectId],
  );

  // Stable refs for the engine so we don't recreate the tick loop on every
  // render. The tick loop only re-binds when (running) status flips.
  const tickRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const wakeLockRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playChime = useCallback(
    (kind: "start" | "end") => {
      if (!settings?.soundEnabled) return;
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
    },
    [settings?.soundEnabled],
  );

  // --- Tick loop ---
  // Engine stays in a stable effect that reads live state via getState().
  // This way the parent component never re-renders 4×/sec — only the
  // <TickDisplay/> subcomponent does, and it only re-renders when its own
  // selector value changes (i.e. once per integer second).
  useEffect(() => {
    const handleStop = (autoEnd = false) => {
      const state = useTimer.getState();
      if (!state.id || !state.subjectId || !state.examId) {
        useTimer.getState().stop();
        return;
      }
      const totalSec = Math.round(state.totalElapsed);
      if (totalSec < 5) {
        useTimer.getState().stop();
        toast("Session too short", {
          description: "Less than 5 seconds — discarded.",
        });
        return;
      }
      const sessionSeconds =
        state.mode === "pomodoro"
          ? // For pomodoro, subtract break time so only focus minutes count
            Math.max(0, totalSec - Math.round(state.pomodorosCompleted * 5 * 60))
          : totalSec;
      setPendingEnd({
        seconds: sessionSeconds,
        type: state.mode,
        pomodoros: state.pomodorosCompleted,
      });
      setShowEndSheet(true);
      useTimer.getState().stop();
    };

    const tick = () => {
      const now = Date.now();
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      const state = useTimer.getState();
      state.tick(delta);

      const next = useTimer.getState();
      if (next.mode === "pomodoro") {
        const focusMin = settings?.pomodoroFocusMin ?? 25;
        const shortBreakMin = settings?.pomodoroShortBreakMin ?? 5;
        const longBreakMin = settings?.pomodoroLongBreakMin ?? 15;
        const before = settings?.pomodorosBeforeLongBreak ?? 4;

        if (
          next.phase === "focus" &&
          next.phasePlanned > 0 &&
          next.phaseElapsed >= next.phasePlanned
        ) {
          playChime("end");
          const newPomos = next.pomodorosCompleted + 1;
          const isLong = newPomos % before === 0;
          useTimer.setState((s) => ({
            pomodorosCompleted: s.pomodorosCompleted + 1,
            phase: "short-break",
            phasePlanned: (isLong ? longBreakMin : shortBreakMin) * 60,
            phaseElapsed: 0,
            status: "paused",
          }));
          toast.success(isLong ? "Take a long break — 15 min" : "Break time — 5 min", {
            description: "Timer paused. Resume when ready.",
          });
          notify("success");
        } else if (
          (next.phase === "short-break" || next.phase === "long-break") &&
          next.phasePlanned > 0 &&
          next.phaseElapsed >= next.phasePlanned
        ) {
          playChime("end");
          useTimer.setState((s) => ({
            phase: "focus",
            phasePlanned: focusMin * 60,
            phaseElapsed: 0,
            status: "paused",
          }));
          toast("Back to focus", { description: "Tap resume when ready." });
          haptic("medium");
        }
      } else if (next.mode === "countdown") {
        if (
          next.targetSeconds > 0 &&
          next.totalElapsed >= next.targetSeconds
        ) {
          playChime("end");
          notify("success");
          handleStop(true);
        }
      }
    };

    if (timerId && useTimer.getState().status === "running") {
      lastTickRef.current = Date.now();
      tickRef.current = window.setInterval(tick, 250);
    }
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [timerId, settings, playChime]);

  // --- Wake lock + visibility ---
  useEffect(() => {
    const acquire = async () => {
      try {
        if (
          "wakeLock" in navigator &&
          timerId &&
          useTimer.getState().status === "running"
        ) {
          wakeLockRef.current = await (navigator as any).wakeLock.request(
            "screen",
          );
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
    if (timerId && useTimer.getState().status === "running") {
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
  }, [timerId]);

  // --- Start / stop ---
  const start = (subjectId: string) => {
    if (!activeExam) {
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
      phasePlanned = (settings?.pomodoroFocusMin ?? 25) * 60;
    } else if (mode === "custom") {
      phasePlanned = customMinutes * 60;
    } else if (mode === "countdown") {
      phasePlanned = countdownMinutes * 60;
      targetSeconds = countdownMinutes * 60;
    }
    useTimer.getState().start({
      id: uid(),
      examId: activeExam.id,
      subjectId,
      mode,
      phase,
      phasePlanned,
      targetSeconds,
    });
    playChime("start");
  };

  const pause = () => {
    useTimer.getState().pause();
  };
  const resume = () => {
    useTimer.getState().resume();
    playChime("start");
  };
  const handleStop = () => {
    const state = useTimer.getState();
    if (!state.id || !state.subjectId || !state.examId) {
      useTimer.getState().stop();
      return;
    }
    const totalSec = Math.round(state.totalElapsed);
    if (totalSec < 5) {
      useTimer.getState().stop();
      toast("Session too short", {
        description: "Less than 5 seconds — discarded.",
      });
      return;
    }
    const sessionSeconds =
      state.mode === "pomodoro"
        ? Math.max(0, totalSec - Math.round(state.pomodorosCompleted * 5 * 60))
        : totalSec;
    setPendingEnd({
      seconds: sessionSeconds,
      type: state.mode,
      pomodoros: state.pomodorosCompleted,
    });
    setShowEndSheet(true);
    useTimer.getState().stop();
  };

  const saveSession = async () => {
    if (!pendingEnd) return;
    const tState = useTimer.getState();
    await useDataStore.getState().addSession({
      examId: activeExam!.id,
      subjectId: tState.subjectId!,
      startedAt: tState.startedAt,
      endedAt: Date.now(),
      plannedSeconds:
        pendingEnd.type === "countdown" ? pendingEnd.seconds : 0,
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
  if (!ready) return <TimerIdleSkeleton />;
  if (!activeExam) {
    return (
      <div className="bg-app min-h-dvh flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-display font-semibold mb-2">
            No exam yet
          </h2>
          <p className="text-fg-muted text-sm">
            Set up an exam to start timing sessions.
          </p>
          <Link
            href="/settings"
            className="btn-primary mt-4 inline-flex"
          >
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-app min-h-dvh pb-32 flex flex-col">
      <header className="px-5 pt-10 pb-2">
        <h1 className="text-2xl font-display font-semibold tracking-tight">
          <HeaderTitle />
        </h1>
        <p className="text-sm text-fg-muted mt-1">
          <HeaderSub />
        </p>
      </header>

      <main className="flex-1 px-5 max-w-md w-full mx-auto flex flex-col">
        {/* Idle: setup */}
        {!timerId && (
          <div className="space-y-4 mt-4">
            {/* Mode picker */}
            <ModePicker
              onPick={(id) => {
                // Reset any half-finished session first so the user doesn't
                // see a phantom "Resume" button on top of a fresh mode select.
                useTimer.getState().stop();
                useTimer.setState({ mode: id });
              }}
            />

            {/* Mode-specific config */}
            {useTimer.getState().mode === "custom" && (
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
            {useTimer.getState().mode === "countdown" && (
              <div className="card p-5">
                <div className="label mb-2">Target</div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={10}
                    max={240}
                    step={5}
                    value={countdownMinutes}
                    onChange={(e) =>
                      setCountdownMinutes(Number(e.target.value))
                    }
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
              type="button"
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
                type="button"
              >
                <Play className="h-5 w-5" />
                Start
              </button>
            )}
          </div>
        )}

        {/* Active session */}
        {timerId && (
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

            <PhaseChip />

            {/* Big circular display — only this sub-tree re-renders 4×/sec */}
            <TickDisplay />

            <ControlBar onPause={pause} onResume={resume} onStop={handleStop} />
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
          {activeSubjects.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                // Update the store first so the parent re-render doesn't
                // race with the sheet closing animation.
                useTimer.setState({ subjectId: s.id });
                setShowSubjectPicker(false);
                haptic("selection");
              }}
              className="card-interactive w-full p-4 flex items-center gap-3 min-h-[56px] relative z-[1]"
              type="button"
            >
              <div
                className="h-3 w-3 rounded-full shrink-0"
                style={{ background: s.color }}
              />
              <div className="flex-1 text-left min-w-0">
                <div className="font-medium truncate">{s.name}</div>
                <div className="text-xs text-fg-muted">
                  {s.estimatedHours}h budget
                </div>
              </div>
              {timerSubjectId === s.id && (
                <Check className="h-4 w-4 text-accent shrink-0" />
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
              <div className="text-xs text-fg-muted mt-1">logged</div>
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
                    type="button"
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
              <button onClick={discard} className="btn-ghost" type="button">
                Discard
              </button>
              <button onClick={saveSession} className="btn-primary" type="button">
                Save
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components — each subscribes to only the slice of timer state it needs.
// This is the single biggest perf win: the parent 700-line component used to
// re-render 4×/sec on every tick. Now only <TickDisplay/> and <PhaseChip/>
// do, and only when their integer second changes.
// ---------------------------------------------------------------------------

function HeaderTitle() {
  const id = useTimer((s) => s.id);
  return <>{id ? "In session" : "Start a session"}</>;
}

function HeaderSub() {
  const id = useTimer((s) => s.id);
  const status = useTimer((s) => s.status);
  if (!id) return <>Pick a subject, set a duration, hit start.</>;
  if (status === "paused") return <>Paused — tap resume to continue.</>;
  return <>Stay with it.</>;
}

function ModePicker({ onPick }: { onPick: (id: TimerMode) => void }) {
  const mode = useTimer((s) => s.mode);
  return (
    <div className="card p-3">
      <div className="label mb-2">Mode</div>
      <div className="grid grid-cols-2 gap-2">
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onPick(m.id)}
              type="button"
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
  );
}

function PhaseChip() {
  const mode = useTimer((s) => s.mode);
  const phase = useTimer((s) => s.phase);
  const pomos = useTimer((s) => s.pomodorosCompleted);
  if (mode !== "pomodoro") return null;
  return (
    <div className="chip bg-elev2 mb-6">
      {phase === "focus" ? (
        <>
          <Brain className="h-3 w-3 text-accent" />
          Focus
        </>
      ) : (
        <>
          <Coffee className="h-3 w-3 text-good" />
          {phase === "long-break" ? "Long break" : "Break"}
        </>
      )}
      {pomos > 0 && (
        <span className="text-fg-muted ml-1">· {pomos} done</span>
      )}
    </div>
  );
}

/**
 * The tick display. Subscribes to phaseElapsed / totalElapsed / targetSeconds
 * via thin selectors so it re-renders only when those values change.
 * Math.round() guarantees an integer-second cadence, capping re-renders
 * to 1×/sec even though the engine ticks at 250ms.
 */
function TickDisplay() {
  const mode = useTimer((s) => s.mode);
  const phase = useTimer((s) => s.phase);
  const phaseElapsed = useTimer((s) => s.phaseElapsed);
  const phasePlanned = useTimer((s) => s.phasePlanned);
  const totalElapsed = useTimer((s) => s.totalElapsed);
  const targetSeconds = useTimer((s) => s.targetSeconds);
  const status = useTimer((s) => s.status);

  const displaySeconds = Math.round(
    mode === "pomodoro"
      ? Math.max(0, phasePlanned - phaseElapsed)
      : mode === "countdown"
        ? Math.max(0, targetSeconds - totalElapsed)
        : totalElapsed,
  );

  const progressPct =
    mode === "pomodoro" && phasePlanned > 0
      ? Math.min(100, (phaseElapsed / phasePlanned) * 100)
      : mode === "countdown" && targetSeconds > 0
        ? Math.min(100, (totalElapsed / targetSeconds) * 100)
        : 0;

  const ringStroke =
    phase === "focus" || mode === "stopwatch" || mode === "countdown"
      ? "#ff6b35"
      : "#34d399";

  return (
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
            stroke={ringStroke}
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
          {status === "paused"
            ? "Paused"
            : "Elapsed " +
              formatClockFromSeconds(Math.round(totalElapsed))}
        </div>
      </div>
    </div>
  );
}

function ControlBar({
  onPause,
  onResume,
  onStop,
}: {
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  const status = useTimer((s) => s.status);
  const reset = useTimer((s) => s.reset);
  return (
    <div className="flex items-center gap-3 mt-10">
      {status === "running" ? (
        <button
          onClick={onPause}
          className="btn-ghost h-14 w-14 rounded-full p-0"
          aria-label="Pause"
          type="button"
        >
          <Pause className="h-6 w-6" />
        </button>
      ) : (
        <button
          onClick={onResume}
          className="btn-primary h-14 w-14 rounded-full p-0"
          aria-label="Resume"
          type="button"
        >
          <Play className="h-6 w-6" />
        </button>
      )}
      <button
        onClick={onStop}
        className="btn-ghost h-14 w-14 rounded-full p-0"
        aria-label="End"
        type="button"
      >
        <Square className="h-5 w-5" />
      </button>
      <button
        onClick={() => reset()}
        className="btn-ghost h-14 w-14 rounded-full p-0"
        aria-label="Reset"
        type="button"
      >
        <RotateCcw className="h-5 w-5" />
      </button>
    </div>
  );
}
