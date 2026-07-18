// Dexie database. Source of truth for all local state.
// Server-side safe — guarded with `typeof window !== "undefined"` for SSR.

"use client";

import Dexie, { type Table } from "dexie";
import type { Exam, Session, Settings, Subject } from "./schema";
import { DEFAULT_SETTINGS } from "./schema";

export class BufferDB extends Dexie {
  exams!: Table<Exam, string>;
  subjects!: Table<Subject, string>;
  sessions!: Table<Session, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super("buffer");
    this.version(1).stores({
      // primary key first, indexes after. Compound index helps the engine.
      exams: "id, date, createdAt",
      subjects: "id, examId, archived, createdAt",
      sessions: "id, subjectId, examId, startedAt, type",
      settings: "id",
    });
  }
}

let _db: BufferDB | null = null;

export function getDb(): BufferDB {
  if (typeof window === "undefined") {
    // SSR should never touch the DB, but throw clearly if someone tries.
    throw new Error("getDb() called on server — wrap in useEffect or 'use client'.");
  }
  if (!_db) _db = new BufferDB();
  return _db;
}

export async function ensureSettings(): Promise<Settings> {
  const db = getDb();
  const existing = await db.settings.get("singleton");
  if (existing) return existing;
  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}
