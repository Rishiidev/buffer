"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Calendar,
  List,
  Trash2,
  Star,
  Clock,
  Filter,
  X,
} from "lucide-react";
import {
  useDataStore,
  useExamSessions,
  useActiveSubjects,
} from "@/lib/stores/data";
import { useTimer } from "@/lib/stores/timer";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/button";
import { HistorySkeleton } from "@/components/skeleton";
import { haptic, notify } from "@/lib/haptics";
import {
  cn,
  formatHMFromSeconds,
  formatClockFromSeconds,
  uid,
} from "@/lib/utils";
import type { Session, Subject } from "@/lib/db/schema";
import { toast } from "sonner";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  parseISO,
} from "date-fns";

export default function HistoryPage() {
  const ready = useDataStore((s) => s.ready);
  const allSubjects = useDataStore((s) => s.subjects);
  const examSessions = useExamSessions();
  const activeSubjects = useActiveSubjects();
  const timer = useTimer();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [query, setQuery] = useState("");
  const [filterSubject, setFilterSubject] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const subjectById = useMemo(
    () => new Map(allSubjects.map((s) => [s.id, s])),
    [allSubjects],
  );

  const filtered = useMemo(() => {
    return examSessions.filter((s) => {
      if (filterSubject && s.subjectId !== filterSubject) return false;
      if (query.trim()) {
        const subj = subjectById.get(s.subjectId)?.name ?? "";
        const hay = `${subj} ${s.notes ?? ""}`.toLowerCase();
        if (!hay.includes(query.toLowerCase().trim())) return false;
      }
      return true;
    });
  }, [examSessions, filterSubject, query, subjectById]);

  const totalsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of examSessions) {
      const d = new Date(s.startedAt);
      const k = format(d, "yyyy-MM-dd");
      map.set(k, (map.get(k) ?? 0) + s.actualSeconds);
    }
    return map;
  }, [examSessions]);

  const totalSec = examSessions.reduce(
    (acc, s) => acc + s.actualSeconds,
    0,
  );

  // Week for calendar view (current week)
  const weekDays = useMemo(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, []);

  if (!ready) return <HistorySkeleton />;

  return (
    <div className="bg-app min-h-dvh pb-32">
      <header className="px-5 pt-10 pb-2">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-display font-semibold tracking-tight">
            History
          </h1>
          <div className="text-right">
            <div className="text-xs text-fg-muted">Total logged</div>
            <div className="text-lg font-display font-semibold num">
              {formatHMFromSeconds(totalSec)}
            </div>
          </div>
        </div>
      </header>

      <main className="px-5 max-w-md w-full mx-auto space-y-4">
        {/* View toggle + search */}
        <div className="flex gap-2">
          <div className="flex bg-elev1 rounded-full p-1">
            <button
              onClick={() => setView("list")}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5",
                view === "list" ? "bg-elev2 text-fg" : "text-fg-muted",
              )}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
            <button
              onClick={() => setView("calendar")}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5",
                view === "calendar" ? "bg-elev2 text-fg" : "text-fg-muted",
              )}
            >
              <Calendar className="h-3.5 w-3.5" /> Calendar
            </button>
          </div>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-faint" />
            <input
              className="field pl-9 py-2.5 text-sm"
              placeholder="Search notes, subjects…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Subject filter chips */}
        {activeSubjects.length > 0 && (
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
            <button
              onClick={() => setFilterSubject(null)}
              className={cn(
                "chip shrink-0",
                filterSubject === null
                  ? "bg-fg text-bg"
                  : "bg-elev2 text-fg-muted",
              )}
            >
              All
            </button>
            {activeSubjects.map((s) => (
              <button
                key={s.id}
                onClick={() => setFilterSubject(s.id)}
                className={cn(
                  "chip shrink-0",
                  filterSubject === s.id
                    ? "bg-fg text-bg"
                    : "bg-elev2 text-fg-muted",
                )}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: s.color }}
                />
                {s.name}
              </button>
            ))}
          </div>
        )}

        {view === "calendar" ? (
          <CalendarView
            weekDays={weekDays}
            totalsByDay={totalsByDay}
            sessions={examSessions}
            subjectById={subjectById}
          />
        ) : (
          <ListView
            sessions={filtered}
            subjectById={subjectById}
            onEdit={setEditing}
          />
        )}

        {examSessions.length === 0 && (
          <div className="card p-6 text-center mt-4">
            <Clock className="h-6 w-6 mx-auto text-fg-faint mb-2" />
            <div className="text-sm font-medium">No sessions yet</div>
            <p className="text-xs text-fg-muted mt-1">
              Start a timer session and it'll show up here.
            </p>
            <Link
              href="/timer"
              className="btn-primary mt-4 inline-flex"
            >
              Start one
            </Link>
          </div>
        )}
      </main>

      {/* Edit modal */}
      <AnimatePresence>
        {editing && (() => {
          const session = examSessions.find((s) => s.id === editing);
          if (!session) {
            // Session was deleted from elsewhere; close the modal safely.
            return null;
          }
          return (
            <EditSessionSheet
              open={true}
              session={session}
              subjectById={subjectById}
              onClose={() => setEditing(null)}
              onDelete={async () => {
                await useDataStore.getState().deleteSession(editing);
                toast("Session deleted");
                setEditing(null);
              }}
              onSave={async (patch) => {
                await useDataStore.getState().updateSession(editing, patch);
                toast.success("Updated");
                setEditing(null);
              }}
            />
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

function ListView({
  sessions,
  subjectById,
  onEdit,
}: {
  sessions: Session[];
  subjectById: Map<string, Subject>;
  onEdit: (id: string) => void;
}) {
  // Group by day
  const byDay = useMemo(() => {
    const m = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const d = new Date(s.startedAt);
      const k = format(d, "yyyy-MM-dd");
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    return Array.from(m.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [sessions]);

  return (
    <div className="space-y-5">
      {byDay.map(([day, items]) => {
        const dayTotal = items.reduce((acc, s) => acc + s.actualSeconds, 0);
        const date = parseISO(day);
        const isToday = isSameDay(date, new Date());
        const isYesterday = isSameDay(date, new Date(Date.now() - 86_400_000));
        return (
          <div key={day}>
            <div className="flex items-baseline justify-between mb-2 px-1">
              <div className="text-xs uppercase tracking-wider text-fg-muted">
                {isToday
                  ? "Today"
                  : isYesterday
                    ? "Yesterday"
                    : format(date, "EEEE, d MMM")}
              </div>
              <div className="text-xs num text-fg-muted">
                {formatHMFromSeconds(dayTotal)}
              </div>
            </div>
            <div className="space-y-2">
              {items.map((s) => {
                const subj = subjectById.get(s.subjectId);
                return (
                  <button
                    key={s.id}
                    onClick={() => onEdit(s.id)}
                    className="card-interactive w-full p-3 flex items-center gap-3 text-left"
                  >
                    <div
                      className="h-9 w-1 rounded-full shrink-0"
                      style={{ background: subj?.color ?? "#6b7280" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <div className="font-medium text-sm truncate">
                          {subj?.name ?? "Unknown"}
                        </div>
                        {s.type === "pomodoro" && (
                          <span className="chip bg-elev2 text-fg-muted text-[10px] px-1.5 py-0.5">
                            {s.pomodorosCompleted ?? 0}p
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-fg-muted flex items-center gap-2 mt-0.5">
                        <span>{format(new Date(s.startedAt), "h:mm a")}</span>
                        {s.notes && (
                          <>
                            <span>·</span>
                            <span className="truncate">{s.notes}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-display font-semibold num">
                        {formatHMFromSeconds(s.actualSeconds)}
                      </div>
                      {s.rating && (
                        <div className="text-xs text-warn">
                          {"★".repeat(s.rating)}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalendarView({
  weekDays,
  totalsByDay,
  sessions,
  subjectById,
}: {
  weekDays: Date[];
  totalsByDay: Map<string, number>;
  sessions: Session[];
  subjectById: Map<string, Subject>;
}) {
  const maxSec = Math.max(1, ...Array.from(totalsByDay.values()));
  return (
    <div className="card p-4">
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((d) => {
          const k = format(d, "yyyy-MM-dd");
          const sec = totalsByDay.get(k) ?? 0;
          const intensity = sec / maxSec;
          const isToday = isSameDay(d, new Date());
          return (
            <div key={k} className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-fg-faint mb-1">
                {format(d, "EEE")}
              </div>
              <div
                className={cn(
                  "h-14 rounded-lg flex flex-col items-center justify-center text-xs",
                  isToday
                    ? "ring-1 ring-accent"
                    : "",
                )}
                style={{
                  background:
                    sec > 0
                      ? `rgba(255, 107, 53, ${0.15 + intensity * 0.85})`
                      : "rgba(255,255,255,0.04)",
                }}
              >
                <div
                  className={cn(
                    "num font-medium",
                    sec > 0 ? "text-white" : "text-fg-muted",
                  )}
                >
                  {sec > 0 ? Math.round(sec / 60) : "·"}
                </div>
                <div
                  className={cn(
                    "text-[9px]",
                    sec > 0 ? "text-white/70" : "text-fg-faint",
                  )}
                >
                  {format(d, "d")}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-xs text-fg-muted mt-3 text-center">
        Minutes logged this week
      </div>
    </div>
  );
}

function EditSessionSheet({
  session,
  subjectById,
  open,
  onClose,
  onSave,
  onDelete,
}: {
  session: Session[][number];
  subjectById: Map<string, Subject>;
  open: boolean;
  onClose: () => void;
  onSave: (patch: Partial<typeof session>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [minutes, setMinutes] = useState(Math.round(session.actualSeconds / 60));
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5 | null>(
    session.rating ?? null,
  );
  const [notes, setNotes] = useState(session.notes ?? "");
  const subj = subjectById.get(session.subjectId);

  return (
    <Sheet open={open} onClose={onClose} title="Edit session">
      <div className="space-y-4">
        <div className="flex items-center gap-2 -mt-2 mb-2">
          {subj && (
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: subj.color }}
            />
          )}
          <span className="text-sm text-fg-muted">{subj?.name ?? "Unknown"}</span>
        </div>

        <div>
          <div className="label mb-2">Duration</div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={600}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="flex-1 accent-accent"
            />
            <div className="text-2xl font-display font-semibold num w-24 text-right">
              {formatClockFromSeconds(minutes * 60)}
            </div>
          </div>
        </div>

        <div>
          <div className="label mb-2">Focus quality</div>
          <div className="flex justify-between gap-2">
            {[1, 2, 3, 4, 5].map((r) => (
              <button
                key={r}
                onClick={() => {
                  haptic("selection");
                  setRating(r as any);
                }}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-medium transition-colors",
                  rating === r
                    ? "bg-accent text-black"
                    : "bg-elev2 text-fg-muted hover:bg-elev2/70",
                )}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="label mb-2">Notes</div>
          <textarea
            className="field min-h-[80px] resize-none"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What did you cover?"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            variant="danger"
            onClick={() => {
              haptic("warning");
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              notify("success");
              onSave({
                actualSeconds: minutes * 60,
                rating: rating ?? undefined,
                notes: notes.trim() || undefined,
              });
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
