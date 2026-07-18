"use client";

import { cn } from "@/lib/utils";

interface HeatmapProps {
  data: Array<{ date: string; hours: number }>;
}

export function Heatmap({ data }: HeatmapProps) {
  // group into weeks (7 columns)
  const weeks: Array<Array<{ date: string; hours: number }>> = [];
  for (let i = 0; i < data.length; i += 7) {
    weeks.push(data.slice(i, i + 7));
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 min-w-fit">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => {
              const intensity = Math.min(1, day.hours / 6); // 6h+ = full
              const fill =
                day.hours === 0
                  ? "rgba(255,255,255,0.04)"
                  : `rgba(255, 107, 53, ${0.2 + intensity * 0.8})`;
              return (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.hours.toFixed(1)}h`}
                  className="h-3.5 w-3.5 rounded-sm"
                  style={{ background: fill }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-1.5 mt-3 text-[10px] text-fg-faint">
        Less
        <div className="h-3 w-3 rounded-sm bg-[rgba(255,255,255,0.04)]" />
        <div className="h-3 w-3 rounded-sm bg-accent/30" />
        <div className="h-3 w-3 rounded-sm bg-accent/60" />
        <div className="h-3 w-3 rounded-sm bg-accent/100" />
        More
      </div>
    </div>
  );
}
