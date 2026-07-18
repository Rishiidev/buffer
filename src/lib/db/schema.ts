// Core domain types for Buffer.
// Pure types — no Dexie imports here so the prediction engine + tests
// can import them without dragging in IndexedDB.

export type ID = string;

export type Risk = "safe" | "on-track" | "at-risk" | "behind";

export type SessionType = "pomodoro" | "custom" | "stopwatch" | "countdown";

export interface Exam {
  id: ID;
  name: string;            // "CA Final — May 2026"
  date: string;            // ISO yyyy-mm-dd
  totalRequiredHours: number;
  dailyCapacityHours: number; // realistic self-assessed avg/day
  createdAt: number;       // epoch ms
}

export interface Subject {
  id: ID;
  examId: ID;
  name: string;
  estimatedHours: number;  // total study hours budgeted for this subject
  color: string;           // hex; used for charts/badges
  archived: boolean;
  createdAt: number;
}

export interface Session {
  id: ID;
  subjectId: ID;
  examId: ID;
  startedAt: number;       // epoch ms
  endedAt: number;         // epoch ms
  plannedSeconds: number;  // 0 if stopwatch
  actualSeconds: number;   // always present, the source of truth
  type: SessionType;
  rating?: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  pomodorosCompleted?: number;
}

export interface Settings {
  id: "singleton";
  theme: "dark" | "light" | "system";
  soundEnabled: boolean;
  pomodoroFocusMin: number;
  pomodoroShortBreakMin: number;
  pomodoroLongBreakMin: number;
  pomodorosBeforeLongBreak: number;
  weekStartsOn: 0 | 1;     // 0 = Sunday
  onboardingComplete: boolean;
  sampleData: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  id: "singleton",
  theme: "dark",
  soundEnabled: true,
  pomodoroFocusMin: 25,
  pomodoroShortBreakMin: 5,
  pomodoroLongBreakMin: 15,
  pomodorosBeforeLongBreak: 4,
  weekStartsOn: 1,
  onboardingComplete: false,
  sampleData: false,
};
