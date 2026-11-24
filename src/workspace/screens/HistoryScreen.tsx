import { useState, useMemo } from "react";
import {
  GitCommit,
  Users,
  Repeat,
  Flame,
  FileCode,
  ArrowLeftRight,
  Search,
} from "lucide-react";
import { useAnalysis } from "../../analysis/AnalysisContext";
import { EmptyState } from "../EmptyState";
import type { CoChange } from "../../analysis/types";

export function HistoryScreen() {
  const analysis = useAnalysis();
  const { commits, contributors, contributorKnowledge, coChanges, churn } = analysis;

  const [selectedCoChange, setSelectedCoChange] = useState<CoChange | null>(
    coChanges.length > 0 ? coChanges[0] : null,
  );
  const [coChangeSearch, setCoChangeSearch] = useState("");
  const [churnSearch] = useState("");

  const filteredCoChanges = useMemo(() => {
    if (!coChangeSearch.trim()) return coChanges;
    const q = coChangeSearch.toLowerCase();
    return coChanges.filter(
      (cc) => cc.fileA.toLowerCase().includes(q) || cc.fileB.toLowerCase().includes(q),
    );
  }, [coChanges, coChangeSearch]);

  const filteredChurn = useMemo(() => {
    if (!churnSearch.trim()) return churn;
    const q = churnSearch.toLowerCase();
    return churn.filter((c) => c.filePath.toLowerCase().includes(q));
  }, [churn, churnSearch]);

  if (commits.length === 0 && contributors.length === 0) {
    return (
      <EmptyState
        title="Git history unavailable"
        body="This repository does not have accessible commit history. GitHub repositories include full git history automatically, while local folders require an accessible .git directory."
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-5 min-w-0">
      {/* Top Banner: Git Telemetry Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-md border border-border bg-surface p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted mb-1">
            <span>Analyzed Commits</span>
            <GitCommit className="h-4 w-4 text-accent" />
          </div>
          <p className="font-mono text-2xl font-bold text-foreground">
            {commits.length > 0 ? commits.length : analysis.commitCount}
          </p>
          <span className="text-[11px] font-mono text-muted">
            {analysis.coverage.history.label}
          </span>
        </div>

        <div className="rounded-md border border-border bg-surface p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted mb-1">
            <span>Active Contributors</span>
            <Users className="h-4 w-4 text-emerald" />
          </div>
          <p className="font-mono text-2xl font-bold text-foreground">{contributors.length}</p>
          <span className="text-[11px] text-muted">
            {contributorKnowledge.length} knowledge profiles
          </span>
        </div>

        <div className="rounded-md border border-border bg-surface p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted mb-1">
            <span>Co-Change Couplings</span>
            <Repeat className="h-4 w-4 text-cyan" />
          </div>
          <p className="font-mono text-2xl font-bold text-foreground">{coChanges.length}</p>
          <span className="text-[11px] text-muted">Jaccard correlation verified</span>
        </div>

        <div className="rounded-md border border-border bg-surface p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted mb-1">
            <span>High Churn Files</span>
            <Flame className="h-4 w-4 text-rust" />
          </div>
          <p className="font-mono text-2xl font-bold text-foreground">
            {churn.filter((c) => c.changeFrequency === "high").length}
          </p>
          <span className="text-[11px] text-muted">Files with heavy modification</span>
        </div>
      </div>

      {/* Contributor Knowledge Directory */}
      {contributorKnowledge.length > 0 && (
        <div className="rounded-md border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              <h2 className="text-xs font-semibold text-foreground tracking-wide uppercase">
                Codebase Ownership & Knowledge Map
              </h2>
            </div>
            <span className="text-[11px] text-muted font-mono">
              Evidence from file-level commit authorship
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {contributorKnowledge.slice(0, 6).map((c) => (
              <div
                key={c.name}
                className="flex flex-col gap-2 rounded-sm border border-border/80 bg-raised/30 p-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground truncate">{c.name}</span>
                  <span className="font-mono text-[11px] text-accent font-medium">
                    {c.commits} commits
                  </span>
                </div>

                <div className="flex items-center gap-3 font-mono text-[11px] text-muted">
                  <span>{c.filesChanged} files</span>
                  {c.linesAdded > 0 && (
                    <span className="text-emerald">+{c.linesAdded.toLocaleString()}</span>
                  )}
                  {c.linesDeleted > 0 && (
                    <span className="text-rust">-{c.linesDeleted.toLocaleString()}</span>
                  )}
                </div>

                {c.primaryModules.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {c.primaryModules.slice(0, 3).map((m) => (
                      <span
                        key={m}
                        className="rounded-xs bg-surface border border-border px-1.5 py-0.2 font-mono text-[10px] text-secondary"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Co-Change Coupling Intelligence (Two Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 cols): Co-Change Couples */}
        <div className="lg:col-span-7 flex flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-cyan" />
              <h2 className="text-xs font-semibold text-foreground tracking-wide uppercase">
                Co-Change Coupling (Jaccard Index)
              </h2>
            </div>
            <div className="relative w-44">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Filter pairs…"
                value={coChangeSearch}
                onChange={(e) => setCoChangeSearch(e.target.value)}
                className="w-full rounded-xs border border-border bg-raised/50 py-1 pl-6 pr-2 text-[11px] text-foreground placeholder:text-muted focus:outline-hidden"
              />
            </div>
          </div>

          <p className="text-[11px] text-muted">
            Files that consistently modify together in the same commits. High Jaccard similarity ($J \ge 0.5$) reveals hidden temporal coupling that static imports may miss.
          </p>

          {filteredCoChanges.length === 0 ? (
            <p className="text-xs text-muted py-6 text-center">
              No co-change relationships detected.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-[420px] overflow-y-auto">
              {filteredCoChanges.slice(0, 50).map((cc, i) => {
                const isSelected =
                  selectedCoChange?.fileA === cc.fileA && selectedCoChange?.fileB === cc.fileB;
                const jaccardScore = cc.jaccard !== undefined ? cc.jaccard : 0;

                return (
                  <div
                    key={i}
                    onClick={() => setSelectedCoChange(cc)}
                    className={`flex items-center justify-between gap-3 rounded-xs border p-2.5 text-xs transition-all cursor-pointer ${
                      isSelected
                        ? "border-cyan bg-cyan/10 shadow-2xs"
                        : "border-border/70 bg-raised/30 hover:border-cyan/40 hover:bg-raised"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 font-mono text-[11px]">
                      <span className="text-foreground font-medium truncate max-w-[180px]">
                        {cc.fileA.split("/").pop()}
                      </span>
                      <ArrowLeftRight className="h-3 w-3 text-cyan shrink-0" />
                      <span className="text-secondary font-medium truncate max-w-[180px]">
                        {cc.fileB.split("/").pop()}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 font-mono text-[11px]">
                      <span className="text-muted">{cc.commitCount} co-commits</span>
                      <span
                        className={`font-bold px-1.5 py-0.2 rounded-xs ${
                          jaccardScore >= 0.6
                            ? "bg-rust/20 text-rust"
                            : jaccardScore >= 0.3
                              ? "bg-amber/20 text-amber"
                              : "bg-surface text-secondary"
                        }`}
                      >
                        J={jaccardScore.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Selected Co-Change Inspector */}
        <div className="lg:col-span-5 flex flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-2xs">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Coupling Relationship Inspector
          </h3>

          {selectedCoChange ? (
            <div className="flex flex-col gap-3 text-xs">
              <div className="rounded-sm border border-border bg-raised/40 p-3 flex flex-col gap-2">
                <span className="text-[10px] font-mono text-muted uppercase">Coupled Files</span>
                <div className="font-mono text-xs text-foreground flex flex-col gap-1">
                  <div className="flex items-center gap-2 p-1.5 rounded-xs bg-surface border border-border">
                    <FileCode className="h-3.5 w-3.5 text-accent shrink-0" />
                    <span className="truncate">{selectedCoChange.fileA}</span>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 rounded-xs bg-surface border border-border">
                    <FileCode className="h-3.5 w-3.5 text-cyan shrink-0" />
                    <span className="truncate">{selectedCoChange.fileB}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xs border border-border bg-raised/30 p-2">
                  <span className="text-[10px] text-muted font-mono uppercase">Co-Commits</span>
                  <p className="font-mono text-sm font-bold text-foreground mt-0.5">
                    {selectedCoChange.commitCount} commits
                  </p>
                </div>
                <div className="rounded-xs border border-border bg-raised/30 p-2">
                  <span className="text-[10px] text-muted font-mono uppercase">Jaccard Score</span>
                  <p className="font-mono text-sm font-bold text-cyan mt-0.5">
                    {selectedCoChange.jaccard !== undefined
                      ? selectedCoChange.jaccard.toFixed(3)
                      : "N/A"}
                  </p>
                </div>
              </div>

              <div className="rounded-sm border border-border bg-surface p-3 text-[11px] text-muted leading-relaxed">
                <strong>Architectural Interpretation:</strong>{" "}
                {selectedCoChange.jaccard && selectedCoChange.jaccard > 0.5
                  ? "Strong co-change affinity. Changes in one file almost always require updating the other. Consider consolidating these into one cohesive module or interface."
                  : "Moderate co-change frequency. Files change together occasionally during shared feature updates or integration tests."}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted py-6 text-center">
              Select a co-change pair to inspect historical details.
            </p>
          )}
        </div>
      </div>

      {/* High Churn Hotspot Files & Recent Commits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Highest Churn Files */}
        <div className="rounded-md border border-border bg-surface p-4 shadow-2xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-rust" />
              <h2 className="text-xs font-semibold text-foreground tracking-wide uppercase">
                High-Churn Files (Volatile Code)
              </h2>
            </div>
            <span className="text-[11px] font-mono text-muted">{filteredChurn.length} files</span>
          </div>

          <div className="flex flex-col gap-1.5 max-h-[380px] overflow-y-auto">
            {filteredChurn.slice(0, 30).map((ch) => (
              <div
                key={ch.filePath}
                className="flex items-center justify-between gap-3 rounded-xs border border-border/80 bg-raised/30 p-2.5 text-xs"
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-mono text-xs font-medium text-foreground truncate">
                    {ch.filePath}
                  </span>
                  <span className="text-[11px] text-muted">
                    {ch.totalCommits} commits · {ch.linesAdded + ch.linesDeleted} lines touched
                  </span>
                </div>
                <span
                  className={`rounded-xs font-mono text-[10px] px-1.5 py-0.5 capitalize shrink-0 font-medium ${
                    ch.changeFrequency === "high"
                      ? "bg-rust/20 text-rust font-bold"
                      : "bg-raised text-muted"
                  }`}
                >
                  {ch.changeFrequency} churn
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Commits Log */}
        <div className="rounded-md border border-border bg-surface p-4 shadow-2xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitCommit className="h-4 w-4 text-accent" />
              <h2 className="text-xs font-semibold text-foreground tracking-wide uppercase">
                Recent Commit Stream
              </h2>
            </div>
            <span className="text-[11px] font-mono text-muted">{commits.length} recorded</span>
          </div>

          <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto">
            {commits.slice(0, 30).map((c) => (
              <div
                key={c.hash}
                className="flex flex-col gap-1 rounded-xs border border-border/70 bg-raised/20 p-2.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                  <span className="text-accent font-semibold">{c.hash.slice(0, 7)}</span>
                  <span className="text-muted truncate">{c.author}</span>
                </div>
                <p className="text-foreground font-medium text-xs truncate">{c.message}</p>
                {c.files && c.files.length > 0 && (
                  <span className="text-[10px] font-mono text-muted truncate">
                    {c.files.length} file{c.files.length === 1 ? "" : "s"} modified
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
