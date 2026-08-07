import { useEffect, useRef, useState } from "react";
import { useAnalysis } from "../../analysis/AnalysisContext";
import { EmptyState } from "../EmptyState";

export function HistoryScreen() {
  const analysis = useAnalysis();
  const { commits, contributors, coChanges, churn } = analysis;
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const topChurned = churn.filter((c) => c.changeFrequency === "high").slice(0, 5);
  const topCoChanges = coChanges.slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-secondary">
        Every change to <span className="font-mono">{analysis.name}</span>, in order.
      </p>

      {/* Contributor summary */}
      {contributors.length > 0 && (
        <div className="rounded-sm border border-border bg-surface px-4 py-3">
          <h3 className="mb-2 text-xs font-medium text-secondary">Contributors</h3>
          <div className="flex flex-wrap gap-3">
            {contributors.slice(0, 8).map((c) => (
              <span
                key={c.name}
                className="flex items-center gap-1.5 text-xs"
              >
                <span className="font-medium text-foreground">{c.name}</span>
                <span className="text-muted">
                  {c.commits} commits ({c.percentage}%)
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Co-change analysis */}
      {topCoChanges.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-secondary">Files that change together</h3>
          <p className="mb-2 text-xs text-muted">
            These file pairs frequently appear in the same commit — evidence of architectural coupling.
          </p>
          <div className="flex flex-col gap-1">
            {topCoChanges.map((cc, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-sm border border-border bg-surface px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs text-foreground">
                  {cc.fileA.split("/").pop()}
                </span>
                <span className="text-muted">↔</span>
                <span className="font-mono text-xs text-foreground">
                  {cc.fileB.split("/").pop()}
                </span>
                <span className="ml-auto whitespace-nowrap text-xs text-muted">
                  {cc.commitCount} co-change{cc.commitCount === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* High churn files */}
      {topChurned.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-secondary">Highest churn files</h3>
          <p className="mb-2 text-xs text-muted">
            Files with the most commit activity — high churn correlates with risk.
          </p>
          <div className="flex flex-col gap-1">
            {topChurned.map((ch, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-sm border border-border bg-surface px-3 py-2 text-sm"
              >
                <span className="flex-1 font-mono text-xs text-foreground truncate">
                  {ch.filePath}
                </span>
                <span className="text-xs text-muted">{ch.totalCommits} commits</span>
                {ch.recentChanges > 0 && (
                  <span className="text-xs text-amber">{ch.recentChanges} recent</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commit timeline */}
      {commits.length === 0 ? (
        <EmptyState
          title="No commit history available"
          body="Commit history is derived from git metadata. For local folders, include the .git directory when picking the folder. GitHub repositories always include history."
        />
      ) : (
        <div
          ref={ref}
          className={`flex flex-col gap-0 pt-2 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        >
          <h3 className="mb-3 text-sm font-medium text-secondary">Commit history</h3>
          {commits.map((c, i) => (
            <div key={c.hash} className="relative flex gap-4">
              <div className="flex w-10 shrink-0 flex-col items-center pt-1">
                <div
                  className={`h-2 w-2 rounded-full ${
                    c.deployed ? "bg-emerald" : "bg-border"
                  }`}
                />
                {i < commits.length - 1 && (
                  <div className="mt-0.5 w-px flex-1 bg-border" />
                )}
              </div>

              <div className="flex flex-1 flex-col gap-1 pb-6">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13px] text-muted">
                    {c.hash}
                  </span>
                  {c.deployed && (
                    <span className="rounded-sm bg-emerald/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald">
                      deployed
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted">{c.author}</span>
                  <span className="text-xs text-muted">
                    {new Date(c.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>

                <p className="text-sm text-foreground">{c.message}</p>

                <div className="flex flex-wrap gap-1">
                  {c.files.map((f) => (
                    <span
                      key={f}
                      className="rounded-sm bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}