"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type TimerPhase = "idle" | "focus" | "short-break" | "long-break";
export type TimerMode = "pomodoro" | "custom" | "stopwatch" | "countdown";

interface ActiveTimer {
  // null when no timer running
  id: string | null;
  examId: string | null;
  subjectId: string | null;
  mode: TimerMode;
  phase: TimerPhase;
  // Pomodoro state
  pomodorosCompleted: number;
  // Time accounting (in seconds)
  totalElapsed: number; // wall-clock seconds since session start
  phaseElapsed: number; // seconds into current phase
  phasePlanned: number; // 0 for stopwatch / focus phase length for pomodoro
  status: "running" | "paused";
  startedAt: number; // epoch ms — when session first started
  // Saved at end:
  plannedSeconds: number;
  // For countdown mode, the total target
  targetSeconds: number;
  // Timer-specific options (used by UI to label things)
  notes?: string;
}

interface TimerState extends ActiveTimer {
  start: (params: {
    id: string;
    examId: string;
    subjectId: string;
    mode: TimerMode;
    phase: TimerPhase;
    phasePlanned: number;
    targetSeconds: number;
  }) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
  tick: (deltaSec: number) => void;
  switchPhase: (phase: TimerPhase, phasePlanned: number) => void;
  incrementPomodoro: () => void;
  setNotes: (n: string) => void;
}

const INITIAL: ActiveTimer = {
  id: null,
  examId: null,
  subjectId: null,
  mode: "pomodoro",
  phase: "idle",
  pomodorosCompleted: 0,
  totalElapsed: 0,
  phaseElapsed: 0,
  phasePlanned: 0,
  status: "running",
  startedAt: 0,
  plannedSeconds: 0,
  targetSeconds: 0,
  notes: "",
};

export const useTimer = create<TimerState>()(
  subscribeWithSelector((set) => ({
    ...INITIAL,
    start: (p) =>
      set({
        id: p.id,
        examId: p.examId,
        subjectId: p.subjectId,
        mode: p.mode,
        phase: p.phase,
        phasePlanned: p.phasePlanned,
        phaseElapsed: 0,
        totalElapsed: 0,
        targetSeconds: p.targetSeconds,
        plannedSeconds: 0,
        pomodorosCompleted: 0,
        status: "running",
        startedAt: Date.now(),
        notes: "",
      }),
    pause: () => set({ status: "paused" }),
    resume: () => set({ status: "running" }),
    stop: () => set({ ...INITIAL }),
    reset: () => set({ ...INITIAL }),
    tick: (deltaSec) =>
      set((s) => {
        if (s.status !== "running") return s;
        const nextPhaseElapsed = s.phaseElapsed + deltaSec;
        const nextTotal = s.totalElapsed + deltaSec;
        return {
          phaseElapsed: nextPhaseElapsed,
          totalElapsed: nextTotal,
          // For pomodoro custom we set plannedSeconds at end from phaseElapsed totals
          plannedSeconds: s.mode === "pomodoro" || s.mode === "custom" || s.mode === "countdown"
            ? nextTotal
            : 0,
        };
      }),
    switchPhase: (phase, phasePlanned) =>
      set({
        phase,
        phasePlanned,
        phaseElapsed: 0,
      }),
    incrementPomodoro: () =>
      set((s) => ({ pomodorosCompleted: s.pomodorosCompleted + 1 })),
    setNotes: (n) => set({ notes: n }),
  })),
);
