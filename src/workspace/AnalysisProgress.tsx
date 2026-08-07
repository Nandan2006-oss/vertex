import { GitBranch, FileSearch, Boxes, Sparkles, Check } from "lucide-react";

const STAGES = [
  { key: "scan", label: "Scanning repository structure", icon: FileSearch },
  { key: "git", label: "Reading Git history", icon: GitBranch },
  { key: "graph", label: "Building dependency graph", icon: Boxes },
  { key: "insights", label: "Generating insights", icon: Sparkles },
];

interface AnalysisProgressProps {
  repoName: string;
  stage: string;
  detail?: string;
  fraction: number;
  onCancel?: () => void;
}

/**
 * Full-screen progress view shown while the analyzer works.
 * Linear progress bar, stage list with check marks as phases complete.
 */
export function AnalysisProgress({
  repoName,
  stage,
  detail,
  fraction,
  onCancel,
}: AnalysisProgressProps) {
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);

  // Which stage index is active (derived from fraction thresholds)
  const activeIndex = fraction < 0.3 ? 0 : fraction < 0.6 ? 1 : fraction < 0.85 ? 2 : 3;

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-md">
        <p className="font-mono text-xs text-muted">analyzing</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground">
          {repoName}
        </h1>

        {/* Stage list */}
        <div className="mt-8 flex flex-col gap-4">
          {STAGES.map((s, i) => {
            const done = i < activeIndex;
            const active = i === activeIndex;
            const Icon = s.icon;
            return (
              <div key={s.key} className="flex items-center gap-3">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
                    done
                      ? "border-emerald bg-emerald/10 text-emerald"
                      : active
                        ? "border-foreground/40 bg-raised text-foreground"
                        : "border-border bg-surface text-muted"
                  }`}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </div>
                <span
                  className={`text-sm transition-colors duration-200 ${
                    done ? "text-muted line-through decoration-border" : active ? "text-foreground" : "text-muted"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-8">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-secondary">{stage}</span>
            <span className="font-mono text-xs text-muted">{pct}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Analysis progress"
            className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border"
          >
            <div
              className="h-full rounded-full bg-foreground transition-[width] duration-300 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
          {detail ? <p className="mt-2 text-xs text-muted">{detail}</p> : null}
        </div>

        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="mt-8 cursor-pointer rounded-sm border border-border px-3 py-1.5 text-xs text-muted transition-colors duration-150 hover:border-foreground/30 hover:text-secondary active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            Cancel analysis
          </button>
        ) : null}
      </div>
    </div>
  );
}
