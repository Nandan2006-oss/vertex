import { GitBranch, FileSearch, Boxes, Sparkles, Check, X } from "lucide-react";

const STAGES = [
  { key: "scan", label: "Scanning repository structure", icon: FileSearch },
  { key: "git", label: "Reading Git commit & churn history", icon: GitBranch },
  { key: "graph", label: "Building dependency graph from imports", icon: Boxes },
  { key: "insights", label: "Generating factual architecture telemetry", icon: Sparkles },
];

interface AnalysisProgressProps {
  repoName: string;
  stage: string;
  detail?: string;
  fraction: number;
  onCancel?: () => void;
}

export function AnalysisProgress({
  repoName,
  stage,
  detail,
  fraction,
  onCancel,
}: AnalysisProgressProps) {
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  const activeIndex = fraction < 0.3 ? 0 : fraction < 0.6 ? 1 : fraction < 0.85 ? 2 : 3;

  return (
    <div className="flex w-full max-w-md flex-col items-center justify-center p-6 text-foreground animate-fade-in">
      <div className="w-full rounded-md border border-border bg-surface p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-accent uppercase tracking-wider font-semibold">
            Analysis in Progress
          </span>
          <span className="font-mono text-xs text-muted">{pct}%</span>
        </div>

        <h1 className="mt-1 font-display text-xl font-bold tracking-tight text-foreground truncate">
          {repoName}
        </h1>

        {/* Progress bar */}
        <div className="mt-4">
          <div
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 w-full overflow-hidden rounded-full bg-raised"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex items-baseline justify-between text-xs">
            <span className="text-secondary font-medium">{stage}</span>
            {detail && <span className="font-mono text-[11px] text-muted truncate max-w-[180px]">{detail}</span>}
          </div>
        </div>

        {/* Stage list */}
        <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4">
          {STAGES.map((s, i) => {
            const done = i < activeIndex;
            const active = i === activeIndex;
            const Icon = s.icon;
            return (
              <div key={s.key} className="flex items-center gap-3">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    done
                      ? "border-emerald/40 bg-emerald/15 text-emerald"
                      : active
                        ? "border-accent bg-accent/15 text-accent animate-pulse"
                        : "border-border bg-raised/40 text-muted"
                  }`}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </div>
                <span
                  className={`text-xs transition-colors ${
                    done
                      ? "text-muted line-through"
                      : active
                        ? "text-foreground font-medium"
                        : "text-muted"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {onCancel && (
          <div className="mt-6 flex justify-center border-t border-border pt-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex cursor-pointer items-center gap-1.5 rounded-xs border border-border bg-raised/40 px-3 py-1.5 text-xs text-muted hover:border-foreground/30 hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              <span>Cancel analysis</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
