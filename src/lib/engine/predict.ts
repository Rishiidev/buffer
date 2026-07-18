// The Buffer prediction engine.
// Pure functions only — no I/O, no DB, no clock side-effects.
// "now" is injected so tests are deterministic.

import { differenceInCalendarDays, startOfDay } from "date-fns";
import type { Exam, Risk, Session, Settings } from "../db/schema";

export interface EngineInput {
  exam: Exam;
  sessions: ReadonlyArray<Session>;
  /** Subject totals — hours budgeted for the exam. Optional. */
  subjectEstimatedHours?: number;
  /** "now" in epoch ms. Defaults to Date.now() in prod. */
  now?: number;
  /** Rolling window for current pace, in days. Default 7. */
  windowDays?: number;
}

export interface EngineOutput {
  daysLeft: number;            // calendar days from today to exam (>=0)
  requiredHours: number;       // total budget
  completedHours: number;      // sum of actualSeconds/3600 across all sessions
  remainingHours: number;      // max(0, required - completed)
  currentPace: number;         // hours/day over last `windowDays`
  requiredPace: number;        // hours/day needed from now to exam to hit target
  expectedCompletionDate: Date;// eta given currentPace extrapolated from today
  bufferDays: number;          // expectedCompletionDate − exam date (positive = early)
  risk: Risk;
  confidencePct: number;       // 0-100 — how confident we are in the prediction
  recommendations: string[];   // human-readable, calm, actionable
  behindHours: number;         // signed: +ve = behind, −ve = ahead
  todayTargetHours: number;    // today's recommended study hours
  streakDays: number;          // consecutive days with >=1 session
}

// ---- helpers ---------------------------------------------------------------

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const SECONDS_PER_HOUR = 3600;

/** Convert a duration in SECONDS to hours (fractional). */
function hoursFromSeconds(seconds: number): number {
  return seconds / SECONDS_PER_HOUR;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Risk bands.
 * The math is deliberately simple and *visible* — users can audit it.
 * - safe:      buffer ≥ +5 days AND currentPace ≥ requiredPace × 0.85
 * - on-track:  buffer ≥ 0  AND currentPace ≥ requiredPace × 0.7
 * - at-risk:   buffer ≥ −3 OR currentPace ≥ requiredPace × 0.5
 * - behind:    everything else
 */
function classifyRisk(bufferDays: number, currentPace: number, requiredPace: number): Risk {
  if (requiredPace <= 0) return "safe"; // nothing to do, congratulations
  const ratio = currentPace / requiredPace;
  if (bufferDays >= 5 && ratio >= 0.85) return "safe";
  if (bufferDays >= 0 && ratio >= 0.7) return "on-track";
  // At-risk = recoverable but tight. Behind = unrecoverable without major cuts.
  // Tight rule: behind when buffer is badly negative OR pace is far below required.
  if (bufferDays < -10 || ratio < 0.35) return "behind";
  if (bufferDays >= -10 && ratio >= 0.5) return "at-risk";
  return "behind";
}

/**
 * Confidence shrinks when:
 * - we have very little data (< windowDays of history)
 * - the user has huge day-to-day variance
 * Returns 0-100.
 */
function computeConfidence(
  sessionsInWindow: ReadonlyArray<Session>,
  windowDays: number,
): number {
  if (sessionsInWindow.length === 0) return 25; // baseline; we know almost nothing

  const dailyTotals = new Map<string, number>();
  for (const s of sessionsInWindow) {
    const key = new Date(s.startedAt).toISOString().slice(0, 10);
    dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + hoursFromSeconds(s.actualSeconds));
  }
  const days = Array.from(dailyTotals.values());
  const mean = days.reduce((a, b) => a + b, 0) / days.length;
  if (mean === 0) return 30;
  const variance =
    days.reduce((acc, v) => acc + (v - mean) ** 2, 0) / days.length;
  const stdev = Math.sqrt(variance);
  const cv = stdev / mean; // coefficient of variation

  // Coverage: how many of the last `windowDays` days have data?
  const coverage = days.length / windowDays;

  // Base 60, +30 for coverage, -25 for volatility. Clamp.
  const confidence = 60 + 30 * clamp(coverage, 0, 1) - 25 * clamp(cv, 0, 2);
  return Math.round(clamp(confidence, 15, 95));
}

function computeStreak(sessions: ReadonlyArray<Session>, now: number): number {
  if (sessions.length === 0) return 0;
  const daysWithStudy = new Set(
    sessions.map((s) => startOfDay(new Date(s.startedAt)).getTime()),
  );
  let streak = 0;
  const today = startOfDay(new Date(now)).getTime();
  for (let i = 0; ; i++) {
    const day = today - i * MS_PER_DAY;
    if (daysWithStudy.has(day)) {
      streak += 1;
    } else if (i === 0) {
      // Today not studied yet — don't break streak, look at yesterday.
      continue;
    } else {
      break;
    }
    if (i > 365) break; // sanity cap
  }
  return streak;
}

// ---- the engine ------------------------------------------------------------

export function runEngine(input: EngineInput): EngineOutput {
  const now = input.now ?? Date.now();
  const windowDays = input.windowDays ?? 7;
  const windowStart = now - windowDays * MS_PER_DAY;

  const examDate = new Date(input.exam.date + "T23:59:59");
  const today = startOfDay(new Date(now));
  const daysLeft = Math.max(0, differenceInCalendarDays(examDate, today));

  const completedSeconds = input.sessions.reduce(
    (acc, s) => acc + Math.max(0, s.actualSeconds),
    0,
  );
  const completedHours = hoursFromSeconds(completedSeconds);
  const requiredHours = Math.max(0, input.exam.totalRequiredHours);
  const remainingHours = Math.max(0, requiredHours - completedHours);

  // Current pace — last `windowDays` of sessions
  const recent = input.sessions.filter((s) => s.startedAt >= windowStart);
  const recentHours = hoursFromSeconds(
    recent.reduce((acc, s) => acc + s.actualSeconds, 0),
  );
  const currentPace = recentHours / windowDays;

  // Required pace from today to exam, capped at remainingHours/remainingDays
  const requiredPace = daysLeft > 0 ? remainingHours / daysLeft : remainingHours;

  // Expected completion: remaining / currentPace (in days from now).
  // currentPace is hours/day, remainingHours is hours → division yields days.
  const etaMs =
    currentPace > 0
      ? now + (remainingHours / currentPace) * MS_PER_DAY
      : now + MS_PER_DAY * 365; // sentinel — never finishes at current pace
  const expectedCompletionDate = new Date(etaMs);

  const bufferDays = Math.round(
    (examDate.getTime() - expectedCompletionDate.getTime()) / MS_PER_DAY,
  );

  const risk = classifyRisk(bufferDays, currentPace, requiredPace);

  const confidencePct = computeConfidence(recent, windowDays);

  // Recommendations — calm, never guilt-trippy, always action-oriented.
  const recommendations: string[] = [];
  if (remainingHours <= 0) {
    recommendations.push("Syllabus covered. Switch to revision and mock tests.");
  } else if (risk === "behind") {
    const bump = Math.max(0.5, round1(requiredPace - currentPace));
    recommendations.push(
      `Add ${bump.toFixed(1)} hr/day for the rest of the run, or you slip past the exam.`,
    );
    recommendations.push("Pick one subject to defer by 10–15% — small cuts beat a crash later.");
  } else if (risk === "at-risk") {
    const bump = Math.max(0.25, round1(requiredPace - currentPace));
    recommendations.push(`Bump daily study by ~${bump.toFixed(1)} hr to restore a 3-day buffer.`);
    recommendations.push("Protect Sundays — that's where most buffers come from.");
  } else if (risk === "on-track") {
    recommendations.push("You're on track. Don't let a single zero-day break the streak.");
  } else {
    recommendations.push("Buffer is healthy. Use spare hours for revision, not new topics.");
  }

  // Today's target = max(1h floor, requiredPace), but never more than dailyCapacityHours+1
  const rawTarget = Math.max(1, requiredPace);
  const todayTargetHours = Math.min(rawTarget, (input.exam.dailyCapacityHours || 8) + 1);

  const behindHours = round1(requiredHours - (completedHours + currentPace * daysLeft));

  return {
    daysLeft,
    requiredHours: round1(requiredHours),
    completedHours: round1(completedHours),
    remainingHours: round1(remainingHours),
    currentPace: round1(currentPace),
    requiredPace: round1(requiredPace),
    expectedCompletionDate,
    bufferDays,
    risk,
    confidencePct,
    recommendations,
    behindHours,
    todayTargetHours: round1(todayTargetHours),
    streakDays: computeStreak(input.sessions, now),
  };
}

// Convenience: today's sessions (used by the dashboard)
export function todaysSessions(sessions: ReadonlyArray<Session>, now?: number): Session[] {
  const t = startOfDay(new Date(now ?? Date.now())).getTime();
  const tomorrow = t + MS_PER_DAY;
  return sessions.filter((s) => s.startedAt >= t && s.startedAt < tomorrow);
}

// Convenience: sessions grouped by date for the heatmap (last N days)
export function sessionsByDay(
  sessions: ReadonlyArray<Session>,
  days: number,
  now?: number,
): Array<{ date: string; hours: number }> {
  const t0 = startOfDay(new Date(now ?? Date.now())).getTime();
  const buckets: Array<{ date: string; hours: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const start = t0 - i * MS_PER_DAY;
    const date = new Date(start).toISOString().slice(0, 10);
    buckets.push({ date, hours: 0 });
  }
  const idx = new Map(buckets.map((b, i) => [b.date, i]));
  for (const s of sessions) {
    const key = new Date(startOfDay(new Date(s.startedAt))).toISOString().slice(0, 10);
    const i = idx.get(key);
    if (i != null) buckets[i].hours += hoursFromSeconds(s.actualSeconds);
  }
  return buckets;
}

export const RISK_META: Record<Risk, { label: string; tone: string }> = {
  safe: { label: "Safe", tone: "text-emerald-400" },
  "on-track": { label: "On track", tone: "text-sky-400" },
  "at-risk": { label: "At risk", tone: "text-amber-400" },
  behind: { label: "Behind", tone: "text-rose-400" },
};

export type { Settings };
