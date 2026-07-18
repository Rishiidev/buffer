"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, Target, Timer, BarChart3, X } from "lucide-react";
import { useData } from "@/lib/hooks/use-data";
import { formatHours, todayISO } from "@/lib/utils";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";

const SAMPLE_SUBJECTS = [
  { name: "Financial Reporting", estimatedHours: 90, color: "#ff6b35" },
  { name: "Audit", estimatedHours: 80, color: "#60a5fa" },
  { name: "Direct Tax", estimatedHours: 75, color: "#34d399" },
  { name: "Indirect Tax", estimatedHours: 65, color: "#fbbf24" },
  { name: "AFM", estimatedHours: 70, color: "#a78bfa" },
];

export default function Onboarding() {
  const router = useRouter();
  const data = useData();
  const [step, setStep] = useState(0);
  const [examName, setExamName] = useState("CA Final — Nov 2026");
  const [examDate, setExamDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 4);
    return d.toISOString().slice(0, 10);
  });
  const [totalHours, setTotalHours] = useState(400);
  const [dailyCapacity, setDailyCapacity] = useState(6);
  const [subjects, setSubjects] = useState(SAMPLE_SUBJECTS);
  const [busy, setBusy] = useState(false);

  // If already set up, leave onboarding
  useEffect(() => {
    if (data.ready && data.settings?.onboardingComplete) {
      router.replace("/");
    }
  }, [data.ready, data.settings, router]);

  const next = () => setStep((s) => Math.min(s + 1, 3));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const exam = await data.addExam({
        name: examName,
        date: examDate,
        totalRequiredHours: totalHours,
        dailyCapacityHours: dailyCapacity,
      });
      for (const s of subjects) {
        if (!s.name.trim()) continue;
        await data.addSubject({
          examId: exam.id,
          name: s.name.trim(),
          estimatedHours: s.estimatedHours,
          color: s.color,
        });
      }
      await data.updateSettings({ onboardingComplete: true });
      toast.success("You're set up. Let's see if you're on track.");
      router.replace("/");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't save. Check the form and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!data.ready) return null;

  return (
    <div className="bg-app min-h-dvh flex flex-col">
      <header className="px-6 pt-10 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-accent grid place-items-center">
            <span className="text-black font-bold text-sm">B</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">Buffer</span>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step
                  ? "w-6 bg-accent"
                  : i < step
                    ? "w-3 bg-accent/50"
                    : "w-3 bg-border"
              }`}
            />
          ))}
        </div>
      </header>

      <main className="flex-1 px-6 pt-4 pb-44 max-w-md w-full mx-auto">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="s0"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <div className="text-xs uppercase tracking-widest text-accent font-medium mb-3">
                Welcome
              </div>
              <h1 className="text-display-md font-display tracking-tight">
                The shortest path
                <br />
                from today to cleared.
              </h1>
              <p className="text-fg-muted mt-4 leading-relaxed">
                Buffer isn't a timer. It's a flight instrument for your exam.
                We'll show you, every morning, whether you're on track — and
                exactly what to do about it if you're not.
              </p>

              <div className="mt-8 space-y-3">
                <Feature
                  icon={<Timer className="h-4 w-4" />}
                  title="Capture time without thinking"
                  body="One tap to start. We remember what you're studying."
                />
                <Feature
                  icon={<Target className="h-4 w-4" />}
                  title="Honest prediction"
                  body={`"You're 17 hours behind" — with the recovery plan attached.`}
                />
                <Feature
                  icon={<BarChart3 className="h-4 w-4" />}
                  title="Course-level progress"
                  body="Every subject, every lecture, every revision — visible."
                />
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="s1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <div className="text-xs uppercase tracking-widest text-accent font-medium mb-3">
                Step 1 of 3
              </div>
              <h1 className="text-display-md font-display tracking-tight">
                What's the exam?
              </h1>
              <p className="text-fg-muted mt-2 leading-relaxed">
                Just one exam. You can add more later.
              </p>

              <div className="mt-6 space-y-4">
                <Field label="Exam name">
                  <input
                    className="field"
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                    placeholder="CA Final — Nov 2026"
                  />
                </Field>
                <Field label="Exam date">
                  <input
                    type="date"
                    className="field"
                    value={examDate}
                    min={todayISO()}
                    onChange={(e) => setExamDate(e.target.value)}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Total hours needed"
                    hint="Your honest estimate for full syllabus coverage."
                  >
                    <input
                      type="number"
                      min={1}
                      className="field num"
                      value={totalHours}
                      onChange={(e) => setTotalHours(Number(e.target.value))}
                    />
                  </Field>
                  <Field
                    label="Hours/day you can do"
                    hint="Be realistic, not aspirational."
                  >
                    <input
                      type="number"
                      min={1}
                      max={16}
                      step={0.5}
                      className="field num"
                      value={dailyCapacity}
                      onChange={(e) => setDailyCapacity(Number(e.target.value))}
                    />
                  </Field>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="s2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <div className="text-xs uppercase tracking-widest text-accent font-medium mb-3">
                Step 2 of 3
              </div>
              <h1 className="text-display-md font-display tracking-tight">
                Subjects & hours
              </h1>
              <p className="text-fg-muted mt-2 leading-relaxed">
                Edit the CA Final subjects or wipe and add your own.
              </p>

              <div className="mt-6 space-y-2">
                {subjects.map((s, i) => (
                  <div
                    key={i}
                    className="card p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-8 w-1.5 rounded-full shrink-0"
                        style={{ background: s.color }}
                      />
                      <input
                        className="bg-transparent flex-1 min-w-0 outline-none text-fg font-medium"
                        value={s.name}
                        placeholder="Subject name"
                        onChange={(e) =>
                          setSubjects((prev) =>
                            prev.map((p, j) =>
                              j === i ? { ...p, name: e.target.value } : p,
                            ),
                          )
                        }
                      />
                      {subjects.length > 1 && (
                        <button
                          onClick={() => {
                            haptic("warning");
                            setSubjects((prev) => prev.filter((_, j) => j !== i));
                          }}
                          className="shrink-0 h-9 w-9 rounded-full bg-elev2 text-fg-muted hover:bg-bad/15 hover:text-bad active:scale-95 transition-all grid place-items-center"
                          aria-label={`Remove ${s.name || "subject"}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pl-3.5">
                      <span className="text-xs text-fg-faint">Budget</span>
                      <input
                        type="number"
                        min={1}
                        className="bg-elev2 w-20 text-right rounded-lg px-2.5 py-1.5 text-sm num outline-none"
                        value={s.estimatedHours}
                        onChange={(e) =>
                          setSubjects((prev) =>
                            prev.map((p, j) =>
                              j === i
                                ? { ...p, estimatedHours: Number(e.target.value) }
                                : p,
                            ),
                          )
                        }
                      />
                      <span className="text-fg-muted text-xs">hours</span>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setSubjects((prev) => [
                      ...prev,
                      { name: "", estimatedHours: 60, color: "#a78bfa" },
                    ])
                  }
                  className="btn-outline w-full mt-2"
                >
                  + Add subject
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="s3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="text-center pt-8"
            >
              <div className="inline-flex h-14 w-14 rounded-2xl bg-accent-soft items-center justify-center mb-5">
                <Sparkles className="h-7 w-7 text-accent" />
              </div>
              <h1 className="text-display-md font-display tracking-tight">
                Ready.
              </h1>
              <p className="text-fg-muted mt-3 leading-relaxed max-w-xs mx-auto">
                We'll show you the truth on day one. {formatHours(totalHours)}
                {" "}of runway, distributed across {subjects.length} subjects.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="fixed bottom-0 inset-x-0 z-50 px-6 safe-bottom bg-gradient-to-t from-bg via-bg/95 to-transparent pt-6">
        <div className="mx-auto max-w-md flex items-center gap-3 pb-4">
          {step > 0 && (
            <button onClick={prev} className="btn-ghost">
              Back
            </button>
          )}
          <button
            onClick={step === 3 ? finish : next}
            disabled={busy}
            className="btn-primary flex-1"
          >
            {step === 3 ? (busy ? "Setting up…" : "Open dashboard") : "Continue"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="card p-3 flex items-start gap-3">
      <div className="h-7 w-7 rounded-lg bg-accent-soft grid place-items-center text-accent shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-fg-muted mt-0.5">{body}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="label mb-1.5">{label}</div>
      {children}
      {hint && <div className="text-xs text-fg-faint mt-1.5">{hint}</div>}
    </label>
  );
}
