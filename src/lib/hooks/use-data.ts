"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { liveQuery } from "dexie";
import { getDb, ensureSettings } from "@/lib/db";
import type { Exam, Session, Settings, Subject } from "@/lib/db/schema";
import { uid } from "@/lib/utils";

/**
 * Single source of truth hook.
 * Loads exams/subjects/sessions from Dexie and exposes mutators.
 * Re-renders on writes via Dexie's liveQuery.
 */
export function useData() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const db = getDb();
    const subs: Array<{ unsubscribe: () => void }> = [];

    const examObs = liveQuery(() =>
      db.exams.orderBy("createdAt").reverse().toArray(),
    ).subscribe({
      next: (v) => setExams(v),
    });
    subs.push(examObs);

    const subjObs = liveQuery(() =>
      db.subjects.orderBy("createdAt").reverse().toArray(),
    ).subscribe({
      next: (v) => setSubjects(v),
    });
    subs.push(subjObs);

    const sessObs = liveQuery(() =>
      db.sessions.orderBy("startedAt").reverse().toArray(),
    ).subscribe({
      next: (v) => setSessions(v),
    });
    subs.push(sessObs);

    ensureSettings().then((s) => {
      setSettings(s);
      setReady(true);
    });

    return () => subs.forEach((s) => s.unsubscribe());
  }, []);

  // Mutators
  const addExam = useCallback(async (data: Omit<Exam, "id" | "createdAt">) => {
    const exam: Exam = { ...data, id: uid(), createdAt: Date.now() };
    await getDb().exams.put(exam);
    return exam;
  }, []);

  const updateExam = useCallback(async (id: string, patch: Partial<Exam>) => {
    await getDb().exams.update(id, patch);
  }, []);

  const deleteExam = useCallback(async (id: string) => {
    const db = getDb();
    await db.transaction("rw", db.exams, db.subjects, db.sessions, async () => {
      await db.exams.delete(id);
      await db.subjects.where("examId").equals(id).delete();
      await db.sessions.where("examId").equals(id).delete();
    });
  }, []);

  const addSubject = useCallback(
    async (data: Omit<Subject, "id" | "createdAt" | "archived">) => {
      const s: Subject = {
        ...data,
        id: uid(),
        createdAt: Date.now(),
        archived: false,
      };
      await getDb().subjects.put(s);
      return s;
    },
    [],
  );

  const updateSubject = useCallback(
    async (id: string, patch: Partial<Subject>) => {
      await getDb().subjects.update(id, patch);
    },
    [],
  );

  const deleteSubject = useCallback(async (id: string) => {
    const db = getDb();
    await db.transaction("rw", db.subjects, db.sessions, async () => {
      await db.subjects.delete(id);
      await db.sessions.where("subjectId").equals(id).delete();
    });
  }, []);

  const addSession = useCallback(
    async (data: Omit<Session, "id">) => {
      const s: Session = { ...data, id: uid() };
      await getDb().sessions.put(s);
      return s;
    },
    [],
  );

  const updateSession = useCallback(
    async (id: string, patch: Partial<Session>) => {
      await getDb().sessions.update(id, patch);
    },
    [],
  );

  const deleteSession = useCallback(async (id: string) => {
    await getDb().sessions.delete(id);
  }, []);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = await ensureSettings();
    const updated = { ...next, ...patch };
    await getDb().settings.put(updated);
    setSettings(updated);
  }, []);

  // Memoize derived arrays so consumers' useMemos don't re-run on every render.
  const activeExam = useMemo(() => exams[0] ?? null, [exams]);
  const activeSubjects = useMemo(
    () => (activeExam ? subjects.filter((s) => s.examId === activeExam.id) : []),
    [subjects, activeExam],
  );
  const examSessions = useMemo(
    () => (activeExam ? sessions.filter((s) => s.examId === activeExam.id) : []),
    [sessions, activeExam],
  );

  return {
    ready,
    exams,
    subjects,
    sessions,
    settings,
    activeExam,
    activeSubjects,
    examSessions,
    addExam,
    updateExam,
    deleteExam,
    addSubject,
    updateSubject,
    deleteSubject,
    addSession,
    updateSession,
    deleteSession,
    updateSettings,
  };
}
