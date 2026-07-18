"use client";

/**
 * Singleton app-data store.
 *
 * Why this exists: the previous per-page `useData()` hook subscribed to
 * three Dexie liveQueries on every page mount. Each tab tap then triggered
 * three async IndexedDB scans + four setState calls before the page could
 * paint — 100–400ms of perceived "loading" on iPhone-class hardware.
 *
 * Fix: one global subscription set up once at the app root, fed into a
 * Zustand store. Pages read from the store synchronously. Zero async on
 * navigation. Initial mount is one IndexedDB open + one settings read.
 */

import { useEffect } from "react";
import { create } from "zustand";
import { liveQuery } from "dexie";
import { getDb, ensureSettings } from "@/lib/db";
import type { Exam, Session, Settings, Subject } from "@/lib/db/schema";
import { uid } from "@/lib/utils";

interface DataState {
  ready: boolean;
  exams: Exam[];
  subjects: Subject[];
  sessions: Session[];
  settings: Settings | null;
  // mutators (kept as store actions so callers don't need a separate hook)
  addExam: (data: Omit<Exam, "id" | "createdAt">) => Promise<Exam>;
  updateExam: (id: string, patch: Partial<Exam>) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;
  addSubject: (
    data: Omit<Subject, "id" | "createdAt" | "archived">,
  ) => Promise<Subject>;
  updateSubject: (id: string, patch: Partial<Subject>) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  addSession: (data: Omit<Session, "id">) => Promise<Session>;
  updateSession: (id: string, patch: Partial<Session>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

export const useDataStore = create<DataState>((set) => ({
  ready: false,
  exams: [],
  subjects: [],
  sessions: [],
  settings: null,

  addExam: async (data) => {
    const exam: Exam = { ...data, id: uid(), createdAt: Date.now() };
    await getDb().exams.put(exam);
    return exam;
  },
  updateExam: async (id, patch) => {
    await getDb().exams.update(id, patch);
  },
  deleteExam: async (id) => {
    const db = getDb();
    await db.transaction("rw", db.exams, db.subjects, db.sessions, async () => {
      await db.exams.delete(id);
      await db.subjects.where("examId").equals(id).delete();
      await db.sessions.where("examId").equals(id).delete();
    });
  },
  addSubject: async (data) => {
    const s: Subject = {
      ...data,
      id: uid(),
      createdAt: Date.now(),
      archived: false,
    };
    await getDb().subjects.put(s);
    return s;
  },
  updateSubject: async (id, patch) => {
    await getDb().subjects.update(id, patch);
  },
  deleteSubject: async (id) => {
    const db = getDb();
    await db.transaction("rw", db.subjects, db.sessions, async () => {
      await db.subjects.delete(id);
      await db.sessions.where("subjectId").equals(id).delete();
    });
  },
  addSession: async (data) => {
    const s: Session = { ...data, id: uid() };
    await getDb().sessions.put(s);
    return s;
  },
  updateSession: async (id, patch) => {
    await getDb().sessions.update(id, patch);
  },
  deleteSession: async (id) => {
    await getDb().sessions.delete(id);
  },
  updateSettings: async (patch) => {
    const next = await ensureSettings();
    const updated = { ...next, ...patch };
    await getDb().settings.put(updated);
    useDataStore.setState({ settings: updated });
  },
}));

/**
 * Mount ONCE at the app root (in layout.tsx). Sets up Dexie liveQueries
 * and writes results into the store. Pages don't need to do anything.
 *
 * Critical: it lives in a useEffect so the subscriptions are created
 * exactly once, on the client, after hydration. Returning early on SSR.
 */
export function DataHydrator() {
  useEffect(() => {
    const db = getDb();

    const subs: Array<{ unsubscribe: () => void }> = [];
    subs.push(
      liveQuery(() => db.exams.orderBy("createdAt").reverse().toArray()).subscribe(
        { next: (exams) => useDataStore.setState({ exams }) },
      ),
    );
    subs.push(
      liveQuery(() => db.subjects.orderBy("createdAt").reverse().toArray()).subscribe(
        { next: (subjects) => useDataStore.setState({ subjects }) },
      ),
    );
    subs.push(
      liveQuery(() => db.sessions.orderBy("startedAt").reverse().toArray()).subscribe(
        { next: (sessions) => useDataStore.setState({ sessions }) },
      ),
    );

    ensureSettings().then((settings) => {
      useDataStore.setState({ settings, ready: true });
    });

    return () => subs.forEach((s) => s.unsubscribe());
  }, []);

  return null;
}

/**
 * Selector helpers — pick exactly the data you need so you only re-render
 * when *that* data changes.
 */
export const useData = useDataStore;

export function useActiveExam() {
  return useDataStore((s) => s.exams[0] ?? null);
}

export function useExamSessions() {
  return useDataStore((s) => {
    const exam = s.exams[0];
    return exam ? s.sessions.filter((x) => x.examId === exam.id) : [];
  });
}

export function useActiveSubjects() {
  return useDataStore((s) => {
    const exam = s.exams[0];
    return exam ? s.subjects.filter((x) => x.examId === exam.id) : [];
  });
}
