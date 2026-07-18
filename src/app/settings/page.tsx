"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  X,
  Calendar,
  Settings as Cog,
  Volume2,
  VolumeX,
  Database,
  RefreshCw,
} from "lucide-react";
import {
  useDataStore,
  useActiveExam,
  useActiveSubjects,
} from "@/lib/stores/data";
import type { Exam, Session, Subject } from "@/lib/db/schema";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { seedSampleData } from "@/lib/seed-sample";
import { cn, uid } from "@/lib/utils";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/button";
import { SettingsSkeleton } from "@/components/skeleton";
import { haptic, notify } from "@/lib/haptics";

const COLORS = [
  "#ff6b35",
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#a78bfa",
  "#fb7185",
  "#22d3ee",
  "#f472b6",
];

export default function SettingsPage() {
  const ready = useDataStore((s) => s.ready);
  const settings = useDataStore((s) => s.settings);
  const activeExam = useActiveExam();
  const activeSubjects = useActiveSubjects();
  const router = useRouter();
  const [showExamModal, setShowExamModal] = useState(false);

  if (!ready || !activeExam) return <SettingsSkeleton />;

  return (
    <div className="bg-app min-h-dvh pb-32">
      <header className="px-5 pt-10 pb-2">
        <h1 className="text-2xl font-display font-semibold tracking-tight">
          Settings
        </h1>
      </header>

      <main className="px-5 max-w-md w-full mx-auto space-y-5">
        {/* Exam */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="label">Exam</div>
            <button
              onClick={() => setShowExamModal(true)}
              className="text-xs text-accent font-medium"
            >
              Edit
            </button>
          </div>
          <div className="card p-4">
            <div className="font-medium">{activeExam.name}</div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <Stat label="Date" value={format(new Date(activeExam.date), "d MMM yyyy")} />
              <Stat label="Required" value={`${activeExam.totalRequiredHours}h`} />
              <Stat
                label="Daily cap"
                value={`${activeExam.dailyCapacityHours}h`}
              />
            </div>
          </div>
        </section>

        {/* Subjects */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="label">Subjects</div>
            <div className="text-xs text-fg-muted">
              {activeSubjects.length} total
            </div>
          </div>
          <div className="space-y-2">
            {activeSubjects.map((s) => (
              <SubjectRow
                key={s.id}
                subject={s}
                onUpdate={async (patch) => {
                  useDataStore.getState().updateSubject(s.id, patch);
                  toast.success("Updated");
                }}
                onDelete={async () => {
                  if (activeSubjects.length <= 1) {
                    toast.error("Need at least one subject");
                    return;
                  }
                  useDataStore.getState().deleteSubject(s.id);
                  toast("Subject removed");
                }}
              />
            ))}
            <NewSubjectRow
              examId={activeExam.id}
              onCreate={async (name, hours, color) => {
                if (!name.trim()) {
                  toast.error("Name required");
                  return;
                }
                useDataStore.getState().addSubject({
                  examId: activeExam!.id,
                  name: name.trim(),
                  estimatedHours: hours,
                  color,
                });
                toast.success("Subject added");
              }}
            />
          </div>
        </section>

        {/* Pomodoro */}
        <section>
          <div className="label mb-2">Pomodoro</div>
          <div className="card p-4 space-y-3">
            <Slider
              label="Focus"
              suffix="min"
              value={settings?.pomodoroFocusMin ?? 25}
              min={5}
              max={90}
              step={5}
              onChange={(v) => useDataStore.getState().updateSettings({ pomodoroFocusMin: v })}
            />
            <Slider
              label="Short break"
              suffix="min"
              value={settings?.pomodoroShortBreakMin ?? 5}
              min={1}
              max={30}
              step={1}
              onChange={(v) => useDataStore.getState().updateSettings({ pomodoroShortBreakMin: v })}
            />
            <Slider
              label="Long break"
              suffix="min"
              value={settings?.pomodoroLongBreakMin ?? 15}
              min={5}
              max={60}
              step={5}
              onChange={(v) => useDataStore.getState().updateSettings({ pomodoroLongBreakMin: v })}
            />
            <Slider
              label="Pomodoros before long break"
              suffix=""
              value={settings?.pomodorosBeforeLongBreak ?? 4}
              min={2}
              max={8}
              step={1}
              onChange={(v) => useDataStore.getState().updateSettings({ pomodorosBeforeLongBreak: v })}
            />
          </div>
        </section>

        {/* Sound */}
        <section>
          <div className="label mb-2">Sound</div>
          <button
            onClick={() =>
              useDataStore.getState().updateSettings({ soundEnabled: !settings?.soundEnabled })
            }
            className="card-interactive w-full p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              {settings?.soundEnabled ? (
                <Volume2 className="h-4 w-4 text-accent" />
              ) : (
                <VolumeX className="h-4 w-4 text-fg-muted" />
              )}
              <div className="text-left">
                <div className="text-sm font-medium">Phase-change chimes</div>
                <div className="text-xs text-fg-muted">
                  {settings?.soundEnabled ? "On" : "Off"}
                </div>
              </div>
            </div>
            <div
              className={cn(
                "w-10 h-6 rounded-full transition-colors relative",
                settings?.soundEnabled ? "bg-accent" : "bg-elev2",
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                  settings?.soundEnabled ? "left-[18px]" : "left-0.5",
                )}
              />
            </div>
          </button>
        </section>

        {/* Data */}
        <section>
          <div className="label mb-2">Data</div>
          <div className="space-y-2">
            <button
              onClick={async () => {
                const ok = window.confirm(
                  "This will load ~14 days of sample sessions for the active exam. Continue?",
                );
                if (!ok) return;
                await seedSampleData();
                toast.success("Sample data loaded");
              }}
              className="card-interactive w-full p-4 flex items-center gap-3"
            >
              <Database className="h-4 w-4 text-fg-muted" />
              <div className="text-left flex-1">
                <div className="text-sm font-medium">Load sample data</div>
                <div className="text-xs text-fg-muted">
                  14 days of realistic sessions so you can see the dashboard.
                </div>
              </div>
            </button>
            <button
              onClick={async () => {
                const ok = window.confirm(
                  "Wipe ALL local data — exams, subjects, sessions. This can't be undone.",
                );
                if (!ok) return;
                const { getDb } = await import("@/lib/db");
                const db = getDb();
                await db.transaction(
                  "rw",
                  db.exams,
                  db.subjects,
                  db.sessions,
                  db.settings,
                  async () => {
                    await db.exams.clear();
                    await db.subjects.clear();
                    await db.sessions.clear();
                    await db.settings.clear();
                  },
                );
                toast("Data wiped");
                router.push("/onboarding");
              }}
              className="card-interactive w-full p-4 flex items-center gap-3 text-bad"
            >
              <RefreshCw className="h-4 w-4" />
              <div className="text-left flex-1">
                <div className="text-sm font-medium">Reset everything</div>
                <div className="text-xs text-fg-muted opacity-80">
                  Wipes all local data and restarts onboarding.
                </div>
              </div>
            </button>
          </div>
        </section>

        <footer className="text-center pt-4 text-xs text-fg-faint">
          Buffer · v0.1 · Local-first · Your data never leaves this device.
        </footer>
      </main>

      <ExamEditSheet
        open={showExamModal && !!activeExam}
        exam={activeExam!}
        onClose={() => setShowExamModal(false)}
            onSave={async (patch) => {
              useDataStore.getState().updateExam(activeExam!.id, patch);
              toast.success("Exam updated");
              setShowExamModal(false);
            }}
            onDelete={async () => {
              const ok = window.confirm(
                "Delete this exam, all its subjects, and all its sessions?",
              );
              if (!ok) return;
              useDataStore.getState().deleteExam(activeExam!.id);
              toast("Exam deleted");
              setShowExamModal(false);
              router.push("/onboarding");
            }}
          />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-fg-faint">
        {label}
      </div>
      <div className="text-sm font-display font-semibold num mt-0.5">{value}</div>
    </div>
  );
}

function Slider({
  label,
  suffix,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm text-fg-muted">{label}</span>
        <span className="text-sm num font-medium">
          {value}
          {suffix && <span className="text-fg-muted ml-0.5">{suffix}</span>}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </div>
  );
}

function SubjectRow({
  subject,
  onUpdate,
  onDelete,
}: {
  subject: Subject;
  onUpdate: (patch: Partial<typeof subject>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(subject.name);
  const [hours, setHours] = useState(subject.estimatedHours);

  return (
    <div className="card p-3 flex items-center gap-3">
      <div
        className="h-8 w-1.5 rounded-full shrink-0"
        style={{ background: subject.color }}
      />
      {editing ? (
        <>
          <input
            className="bg-elev2 rounded-lg px-2 py-1 text-sm flex-1 outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              onUpdate({ name, estimatedHours: hours });
              setEditing(false);
            }}
            autoFocus
          />
          <input
            type="number"
            min={1}
            className="bg-elev2 w-16 text-right rounded-lg px-2 py-1 text-sm num outline-none"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          />
          <span className="text-fg-muted text-xs">hr</span>
        </>
      ) : (
        <>
          <button
            onClick={() => setEditing(true)}
            className="flex-1 text-left font-medium text-sm"
          >
            {subject.name}
          </button>
          <span className="text-fg-muted text-xs num">
            {subject.estimatedHours}h
          </span>
          <button onClick={onDelete} className="text-fg-faint hover:text-bad">
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}

function NewSubjectRow({
  examId,
  onCreate,
}: {
  examId: string;
  onCreate: (name: string, hours: number, color: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [hours, setHours] = useState(60);
  const [color, setColor] = useState(COLORS[Math.floor(Math.random() * COLORS.length)]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-outline w-full mt-2"
      >
        <Plus className="h-4 w-4" />
        Add subject
      </button>
    );
  }
  return (
    <div className="card p-3 space-y-3">
      <input
        autoFocus
        className="field"
        placeholder="Subject name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          className="bg-elev2 rounded-lg px-3 py-2 w-20 text-sm num outline-none"
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
        />
        <span className="text-fg-muted text-xs">hours budget</span>
        <div className="flex-1" />
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn(
                "h-5 w-5 rounded-full transition-transform",
                color === c ? "scale-125 ring-2 ring-white" : "",
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className="btn-ghost flex-1">
          Cancel
        </button>
        <button
          onClick={async () => {
            await onCreate(name, hours, color);
            setName("");
            setOpen(false);
          }}
          className="btn-primary flex-1"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function ExamEditSheet({
  open,
  exam,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  exam: Exam;
  onClose: () => void;
  onSave: (patch: Partial<Exam>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [name, setName] = useState(exam.name);
  const [date, setDate] = useState(exam.date);
  const [hours, setHours] = useState(exam.totalRequiredHours);
  const [capacity, setCapacity] = useState(exam.dailyCapacityHours);

  return (
    <Sheet open={open} onClose={onClose} title="Edit exam">
      <div className="space-y-4">
        <label className="block">
          <div className="label mb-1.5">Name</div>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <div className="label mb-1.5">Date</div>
          <input
            type="date"
            className="field"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <div className="label mb-1.5">Required hrs</div>
            <input
              type="number"
              min={1}
              className="field num"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
            />
          </label>
          <label className="block">
            <div className="label mb-1.5">Daily capacity</div>
            <input
              type="number"
              min={1}
              max={16}
              step={0.5}
              className="field num"
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button variant="danger" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          <Button
            variant="primary"
            onClick={() =>
              onSave({
                name,
                date,
                totalRequiredHours: hours,
                dailyCapacityHours: capacity,
              })
            }
          >
            Save
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

// (seedSampleData moved to src/lib/seed-sample.ts — shared with onboarding)
