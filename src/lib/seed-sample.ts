// Sample-data seeder. Builds a believable 14-day history so users can
// see the dashboard light up immediately. Idempotent w.r.t. the store —
// pulls current state from the singleton, no props needed.

"use client";

import { subDays } from "date-fns";
import { useDataStore } from "./stores/data";
import type { Session } from "./db/schema";

const SUBJECTS_PER_DAY = () => 2 + Math.floor(Math.random() * 2);

export async function seedSampleData(): Promise<number> {
  const state = useDataStore.getState();
  const exam = state.exams[0] ?? null;
  if (!exam) return 0;
  const subjects = state.subjects.filter((s) => s.examId === exam.id);
  if (subjects.length === 0) return 0;

  const now = Date.now();
  const sessions: Array<Omit<Session, "id">> = [];

  // Skip the very latest day (today) so user still has a clean "start" feeling.
  for (let d = 14; d >= 1; d--) {
    const day = subDays(now, d);
    // Burnout marker — one empty day mid-stretch
    const sessionsThatDay = d === 7 ? 0 : SUBJECTS_PER_DAY();
    for (let i = 0; i < sessionsThatDay; i++) {
      const subj = subjects[Math.floor(Math.random() * subjects.length)];
      const startHour = 9 + Math.floor(Math.random() * 9);
      const start = new Date(day);
      start.setHours(startHour, Math.floor(Math.random() * 60), 0, 0);
      const actualMin = 25 + Math.floor(Math.random() * 70); // 25–95 min
      const startMs = start.getTime();
      sessions.push({
        examId: exam.id,
        subjectId: subj.id,
        startedAt: startMs,
        endedAt: startMs + actualMin * 60 * 1000,
        plannedSeconds: 0,
        actualSeconds: actualMin * 60,
        type: Math.random() > 0.6 ? "pomodoro" : "custom",
        rating: (1 + Math.floor(Math.random() * 5)) as 1 | 2 | 3 | 4 | 5,
        notes: undefined,
        pomodorosCompleted: undefined,
      });
    }
  }

  for (const s of sessions) {
    await state.addSession(s);
  }
  return sessions.length;
}
