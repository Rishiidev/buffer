import { describe, it, expect } from "vitest";
import { runEngine, todaysSessions, sessionsByDay } from "./predict";
import type { Exam, Session } from "../db/schema";

const NOW = new Date("2026-07-18T10:00:00Z").getTime();
const EXAM_DATE = "2026-10-20"; // ~94 days out
const MS_H = 3_600_000;

function makeExam(over: Partial<Exam> = {}): Exam {
  return {
    id: "exam-1",
    name: "CA Final — Nov 2026",
    date: EXAM_DATE,
    totalRequiredHours: 400,
    dailyCapacityHours: 6,
    createdAt: NOW - 30 * MS_H * 24,
    ...over,
  };
}

function makeSession(
  startedAt: number,
  actualSeconds: number,
  id = `s-${startedAt}`,
): Session {
  return {
    id,
    subjectId: "subj-1",
    examId: "exam-1",
    startedAt,
    endedAt: startedAt + actualSeconds * 1000,
    plannedSeconds: 0,
    actualSeconds,
    type: "stopwatch",
  };
}

describe("runEngine — basics", () => {
  it("returns zero days left if exam is today", () => {
    const out = runEngine({
      exam: makeExam({ date: "2026-07-18" }),
      sessions: [],
      now: NOW,
    });
    expect(out.daysLeft).toBe(0);
  });

  it("computes remaining hours as required - completed", () => {
    const sessions = [makeSession(NOW - MS_H * 24, 5 * 3600)]; // 5h done
    const out = runEngine({ exam: makeExam(), sessions, now: NOW });
    expect(out.completedHours).toBe(5);
    expect(out.remainingHours).toBe(395);
  });

  it("clamps remaining at 0 when over-studied", () => {
    const sessions = [makeSession(NOW - MS_H * 24, 999 * 3600)];
    const out = runEngine({ exam: makeExam(), sessions, now: NOW });
    expect(out.remainingHours).toBe(0);
  });

  it("currentPace uses only the window", () => {
    const sessions = [
      makeSession(NOW - 30 * MS_H * 24, 50 * 3600), // 30 days ago — outside window
      makeSession(NOW - 2 * MS_H * 24, 7 * 3600),    // inside window
      makeSession(NOW - 1 * MS_H * 24, 7 * 3600),    // inside window
    ];
    const out = runEngine({ exam: makeExam(), sessions, now: NOW, windowDays: 7 });
    // 14h over 7 days = 2 hr/day
    expect(out.currentPace).toBe(2);
  });

  it("classifies risk as safe when buffer is healthy", () => {
    // Heavy recent pace, plenty of buffer
    const recent = Array.from({ length: 7 }, (_, i) =>
      makeSession(NOW - (i + 1) * MS_H * 24, 6 * 3600),
    );
    const out = runEngine({ exam: makeExam(), sessions: recent, now: NOW });
    expect(out.risk).toBe("safe");
    expect(out.bufferDays).toBeGreaterThan(0);
  });

  it("classifies risk as behind when current pace is way under required", () => {
    const recent = Array.from({ length: 7 }, (_, i) =>
      makeSession(NOW - (i + 1) * MS_H * 24, 30 * 60), // 30 min/day
    );
    const out = runEngine({ exam: makeExam(), sessions: recent, now: NOW });
    expect(out.risk).toBe("behind");
  });

  it("gives a positive bufferDays when ahead, negative when behind", () => {
    const heavy = Array.from({ length: 14 }, (_, i) =>
      makeSession(NOW - (i + 1) * MS_H * 24, 8 * 3600),
    );
    const ahead = runEngine({ exam: makeExam(), sessions: heavy, now: NOW });
    expect(ahead.bufferDays).toBeGreaterThan(0);

    const light = Array.from({ length: 14 }, (_, i) =>
      makeSession(NOW - (i + 1) * MS_H * 24, 1 * 3600),
    );
    const behind = runEngine({ exam: makeExam(), sessions: light, now: NOW });
    expect(behind.bufferDays).toBeLessThan(0);
  });

  it("recommendations are non-empty in every risk state", () => {
    const cases = [
      { sessions: [], risk: "behind" },
      { sessions: Array.from({ length: 7 }, (_, i) => makeSession(NOW - (i + 1) * MS_H * 24, 6 * 3600)), risk: "safe" },
    ];
    for (const c of cases) {
      const out = runEngine({ exam: makeExam(), sessions: c.sessions, now: NOW });
      expect(out.recommendations.length).toBeGreaterThan(0);
      // Never contains guilt-trippy "failed" language.
      const blob = out.recommendations.join(" ").toLowerCase();
      expect(blob).not.toMatch(/fail|shame|disappoint/);
    }
  });

  it("confidence is between 0 and 100", () => {
    const empty = runEngine({ exam: makeExam(), sessions: [], now: NOW });
    expect(empty.confidencePct).toBeGreaterThanOrEqual(0);
    expect(empty.confidencePct).toBeLessThanOrEqual(100);

    const dense = Array.from({ length: 30 }, (_, i) =>
      makeSession(NOW - i * MS_H * 24, 6 * 3600),
    );
    const out = runEngine({ exam: makeExam(), sessions: dense, now: NOW });
    expect(out.confidencePct).toBeGreaterThan(50);
  });

  it("streak counts consecutive days", () => {
    const days = [0, 1, 2, 4]; // skip day 3
    const sessions = days.map((d) => makeSession(NOW - d * MS_H * 24, 3600));
    const out = runEngine({ exam: makeExam(), sessions, now: NOW });
    // Streak from today = 0,1,2 → 3; then breaks at day 3.
    expect(out.streakDays).toBe(3);
  });
});

describe("todaysSessions", () => {
  it("returns only sessions whose startedAt is in today's local day", () => {
    const sessions = [
      makeSession(NOW - 2 * 3600 * 1000, 1800),         // 2h ago today
      makeSession(NOW - 26 * 3600 * 1000, 3600),        // yesterday
    ];
    const out = todaysSessions(sessions, NOW);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(sessions[0].id);
  });
});

describe("sessionsByDay", () => {
  it("emits `days` consecutive buckets ending today", () => {
    const sessions = [makeSession(NOW - 3600 * 1000, 1800)];
    const out = sessionsByDay(sessions, 7, NOW);
    expect(out).toHaveLength(7);
    expect(out[6].hours).toBe(0.5);
    expect(out[5].hours).toBe(0);
  });
});
