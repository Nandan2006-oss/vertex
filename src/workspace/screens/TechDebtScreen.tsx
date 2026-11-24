import { useState, useMemo } from "react";
import {
  Search,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { useAnalysis, useWorkspaceNav } from "../../analysis/AnalysisContext";
import { EmptyState } from "../EmptyState";

type SortKey = "risk" | "complexity" | "churn" | "age" | "name";
type SeverityFilter = "all" | "critical" | "elevated" | "moderate" | "low";

export function TechDebtScreen() {
  const analysis = useAnalysis();
  const { navigateToScreen } = useWorkspaceNav();
  const techDebt = analysis.techDebt;

  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("risk");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    techDebt.length > 0 ? techDebt[0].id : null,
  );

  // Distribution calculations
  const distribution = useMemo(() => {
    let critical = 0;
    let elevated = 0;
    let moderate = 0;
    let low = 0;

    techDebt.forEach((item) => {
      if (item.riskScore >= 70) critical++;
      else if (item.riskScore >= 45) elevated++;
      else if (item.riskScore >= 25) moderate++;
      else low++;
    });

    const avgScore =
      techDebt.length > 0
        ? Math.round(techDebt.reduce((s, i) => s + i.riskScore, 0) / techDebt.length)
        : 0;

    return { critical, elevated, moderate, low, avgScore };
  }, [techDebt]);

  // Filter & Sort
  const filteredItems = useMemo(() => {
    return techDebt
      .filter((item) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            item.hotspot.toLowerCase().includes(q) ||
            item.filePath.toLowerCase().includes(q) ||
            item.detail.toLowerCase().includes(q);
          if (!match) return false;
        }

        // Severity tier
        if (severityFilter === "critical" && item.riskScore < 70) return false;
        if (severityFilter === "elevated" && (item.riskScore < 45 || item.riskScore >= 70))
          return false;
        if (severityFilter === "moderate" && (item.riskScore < 25 || item.riskScore >= 45))
          return false;
        if (severityFilter === "low" && item.riskScore >= 25) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortKey === "risk") return b.riskScore - a.riskScore;
        if (sortKey === "age") {
          const parseDays = (s: string) => parseInt(s, 10) || 0;
          return parseDays(b.agingDebt) - parseDays(a.agingDebt);
        }
        if (sortKey === "name") return a.hotspot.localeCompare(b.hotspot);
        // Complexity or churn from factors
        if (sortKey === "complexity") {
          const cA = a.factors.find((f) => f.name.toLowerCase().includes("complexity"))?.contribution ?? 0;
          const cB = b.factors.find((f) => f.name.toLowerCase().includes("complexity"))?.contribution ?? 0;
          return cB - cA;
        }
        if (sortKey === "churn") {
          const cA = a.factors.find((f) => f.name.toLowerCase().includes("churn"))?.contribution ?? 0;
          const cB = b.factors.find((f) => f.name.toLowerCase().includes("churn"))?.contribution ?? 0;
          return cB - cA;
        }
        return 0;
      });
  }, [techDebt, searchQuery, severityFilter, sortKey]);

  // Selected item
  const selectedItem = useMemo(() => {
    return techDebt.find((i) => i.id === selectedItemId) ?? filteredItems[0] ?? null;
  }, [techDebt, selectedItemId, filteredItems]);

  if (techDebt.length === 0) {
    return (
      <EmptyState
        title="No technical debt hotspots detected"
        body="Technical debt items are calculated from code complexity markers and historical churn for source files. Small repositories or clean codebases may surface no elevated hotspots."
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 min-w-0">
      {/* Risk Distribution Header Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <SeverityCard
          label="Critical Risk (>70)"
          count={distribution.critical}
          color="rust"
          active={severityFilter === "critical"}
          onClick={() =>
            setSeverityFilter(severityFilter === "critical" ? "all" : "critical")
          }
        />
        <SeverityCard
          label="Elevated Risk (45–70)"
          count={distribution.elevated}
          color="amber"
          active={severityFilter === "elevated"}
          onClick={() =>
            setSeverityFilter(severityFilter === "elevated" ? "all" : "elevated")
          }
        />
        <SeverityCard
          label="Moderate Risk (25–45)"
          count={distribution.moderate}
          color="cyan"
          active={severityFilter === "moderate"}
          onClick={() =>
            setSeverityFilter(severityFilter === "moderate" ? "all" : "moderate")
          }
        />
        <SeverityCard
          label="Low / Stable (<25)"
          count={distribution.low}
          color="emerald"
          active={severityFilter === "low"}
          onClick={() => setSeverityFilter(severityFilter === "low" ? "all" : "low")}
        />
        <div className="col-span-2 sm:col-span-1 rounded-md border border-border bg-surface p-3 flex flex-col justify-between shadow-2xs">
          <span className="text-[11px] font-medium text-secondary">Mean Codebase Risk</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-mono text-xl font-bold text-foreground">
              {distribution.avgScore}
            </span>
            <span className="text-xs text-muted font-mono">/100</span>
          </div>
        </div>
      </div>

      {/* Filter & Sorting Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface p-2.5 shadow-2xs">
        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search hotspots or file paths…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xs border border-border bg-raised/50 py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted focus:border-accent/50 focus:outline-hidden transition-colors"
          />
        </div>

        {/* Sort Options */}
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span>Sort:</span>
          {(["risk", "complexity", "churn", "age", "name"] as SortKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortKey(key)}
              className={`cursor-pointer rounded-xs px-2 py-1 text-xs capitalize transition-colors ${
                sortKey === key
                  ? "bg-accent/20 text-accent font-semibold"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {/* Split Workspace: Left List + Right Detail Panel */}
      <div className="flex flex-1 gap-4 min-h-[540px]">
        {/* Left: Ranked Hotspot List */}
        <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto max-h-[580px] min-w-0 pr-1">
          {filteredItems.length === 0 ? (
            <div className="rounded-md border border-border bg-surface p-8 text-center text-xs text-muted">
              No technical debt items match the selected filters.
            </div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = selectedItem?.id === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={`group flex items-start justify-between gap-3 rounded-sm border p-3 text-xs transition-all cursor-pointer ${
                    isSelected
                      ? "border-accent bg-accent/10 shadow-2xs"
                      : "border-border/80 bg-surface hover:border-accent/30 hover:bg-raised/60"
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-xs font-mono font-bold text-xs ${
                        item.riskScore >= 70
                          ? "bg-rust/20 text-rust"
                          : item.riskScore >= 45
                            ? "bg-amber/20 text-amber"
                            : "bg-emerald/20 text-emerald"
                      }`}
                    >
                      {item.riskScore}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-foreground truncate">
                          {item.hotspot}
                        </span>
                        {item.agingDebt && (
                          <span className="rounded-xs bg-raised px-1.5 py-0.2 font-mono text-[10px] text-muted">
                            {item.agingDebt}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-muted truncate mt-0.5">
                        {item.filePath}
                      </span>

                      {/* Factor badges */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {item.factors.slice(0, 3).map((f, fi) => (
                          <span
                            key={fi}
                            className="rounded-xs bg-raised/70 border border-border/70 px-1.5 py-0.2 font-mono text-[10px] text-secondary"
                          >
                            {f.name}: +{f.contribution}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <ChevronRight
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      isSelected ? "text-accent translate-x-0.5" : "text-muted group-hover:text-foreground"
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Right: Detailed Evidence Inspector */}
        {selectedItem && (
          <div className="w-80 lg:w-[420px] shrink-0 rounded-md border border-border bg-surface p-4 flex flex-col gap-4 shadow-xl overflow-y-auto max-h-[580px] animate-fade-in">
            {/* Header */}
            <div className="border-b border-border pb-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-muted uppercase">Hotspot Telemetry</span>
                <button
                  type="button"
                  onClick={() => navigateToScreen("architecture", selectedItem.hotspot)}
                  className="flex items-center gap-1 text-[11px] text-accent hover:underline cursor-pointer font-medium"
                >
                  Inspect in Graph <ExternalLink className="h-3 w-3" />
                </button>
              </div>
              <h2 className="font-mono text-sm font-bold text-foreground mt-1 break-all">
                {selectedItem.hotspot}
              </h2>
              <p className="font-mono text-[11px] text-muted break-all mt-0.5">
                {selectedItem.filePath}
              </p>
            </div>

            {/* Score Summary Box */}
            <div className="rounded-sm border border-border/80 bg-raised/30 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Composite Risk Score</span>
                <span
                  className={`font-mono text-lg font-bold ${
                    selectedItem.riskScore >= 70
                      ? "text-rust"
                      : selectedItem.riskScore >= 45
                        ? "text-amber"
                        : "text-emerald"
                  }`}
                >
                  {selectedItem.riskScore} / 100
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    selectedItem.riskScore >= 70
                      ? "bg-rust"
                      : selectedItem.riskScore >= 45
                        ? "bg-amber"
                        : "bg-emerald"
                  }`}
                  style={{ width: `${Math.min(100, selectedItem.riskScore)}%` }}
                />
              </div>
              <p className="text-[11px] text-secondary mt-1">
                {selectedItem.detail ||
                  "Composite calculated from structural complexity, churn velocity, coupling and volume."}
              </p>
            </div>

            {/* Evidence Factor Breakdown */}
            <div className="flex flex-col gap-2.5">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                Contributing Risk Factors
              </h3>

              {selectedItem.factors.length === 0 ? (
                <p className="text-xs text-muted">No individual factor breakdown available.</p>
              ) : (
                selectedItem.factors.map((factor, fi) => (
                  <div
                    key={fi}
                    className="flex flex-col gap-1 rounded-sm border border-border/80 bg-raised/20 p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{factor.name}</span>
                      <span className="font-mono font-bold text-accent">
                        +{factor.contribution} pts
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-muted">
                      <span>Observed: {factor.evidence.metric}</span>
                      <span className="text-secondary font-semibold">{factor.evidence.value}</span>
                    </div>
                    <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                      {factor.evidence.explanation}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Observed History */}
            {selectedItem.firstObserved && (
              <div className="flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted">
                <span>First observed:</span>
                <span className="font-mono text-secondary">{selectedItem.firstObserved}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Honest Heuristic Disclaimer */}
      <div className="rounded-md border border-border bg-surface px-4 py-2.5 text-xs text-muted flex items-center gap-2 shadow-2xs">
        <ShieldCheck className="h-4 w-4 text-emerald shrink-0" />
        <span>
          <strong>Honest Analysis Guarantee:</strong> Risk scores are transparent mathematical heuristics derived from real static analysis ASTs and git commit records. They reflect refactoring priority, not guaranteed software bugs.
        </span>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function SeverityCard({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color: "rust" | "amber" | "cyan" | "emerald";
  active?: boolean;
  onClick: () => void;
}) {
  const colorMap = {
    rust: "text-rust",
    amber: "text-amber",
    cyan: "text-cyan",
    emerald: "text-emerald",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col justify-between rounded-md border p-3 text-left transition-all cursor-pointer shadow-2xs ${
        active
          ? "border-accent bg-raised"
          : "border-border bg-surface hover:border-accent/40 hover:bg-raised/50"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-secondary truncate">{label}</span>
        <span className={`h-1.5 w-1.5 rounded-full ${color === "rust" ? "bg-rust" : color === "amber" ? "bg-amber" : color === "cyan" ? "bg-cyan" : "bg-emerald"}`} />
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className={`font-mono text-xl font-bold ${colorMap[color]}`}>{count}</span>
        <span className="text-[11px] text-muted">hotspots</span>
      </div>
    </button>
  );
}
