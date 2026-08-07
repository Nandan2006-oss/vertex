import { useState, useMemo } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { useAnalysis } from "../../analysis/AnalysisContext";
import { EmptyState } from "../EmptyState";
import type { TechDebtItem } from "../../analysis/types";

type SortKey = "risk" | "age" | "name";

export function TechDebtScreen() {
  const analysis = useAnalysis();
  const techDebt = analysis.techDebt;
  const [sort, setSort] = useState<SortKey>("risk");
  const [expanded, setExpanded] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const items = [...techDebt];
    switch (sort) {
      case "risk":
        return items.sort((a, b) => b.riskScore - a.riskScore);
      case "age": {
        const parseDays = (s: string) => parseInt(s, 10) || 0;
        return items.sort((a, b) => parseDays(b.agingDebt) - parseDays(a.agingDebt));
      }
      case "name":
        return items.sort((a, b) => a.hotspot.localeCompare(b.hotspot));
      default:
        return items;
    }
  }, [sort, techDebt]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-foreground">{sorted.length} items</span>
        <span className="text-xs text-muted">sorted by</span>
        <div className="flex gap-1">
          {(["risk", "age", "name"] as SortKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              className={`cursor-pointer rounded-sm px-2 py-1 text-xs font-medium transition-colors ${
                sort === key ? "bg-raised text-foreground" : "text-muted hover:text-secondary"
              }`}
            >
              {key === "risk" ? "Risk" : key === "age" ? "Age" : "Name"}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted">
        Risk scores are calculated from complexity, churn, coupling, file size, and contributor concentration.
        Only source files are considered — documentation, config, and generated files are excluded.
      </p>

      {techDebt.length === 0 ? (
        <EmptyState
          title="No hotspots detected"
          body="Tech debt items are calculated from code metrics and commit history for source files only. Small or low-activity repositories may not surface any."
        />
      ) : (
        <div className="flex flex-col gap-1">
          {sorted.map((item) => (
            <DebtItemRow
              key={item.id}
              item={item}
              isExpanded={expanded === item.id}
              onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DebtItemRow({
  item,
  isExpanded,
  onToggle,
}: {
  item: TechDebtItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-sm border border-border bg-surface text-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-start gap-3 px-3 py-3 text-left"
      >
        {/* Risk bar + icon */}
        <div className="flex w-20 shrink-0 flex-col items-center gap-1 pt-0.5">
          <div className="flex items-center gap-1">
            <AlertTriangle
              aria-hidden="true"
              className={`h-3.5 w-3.5 ${
                item.riskScore >= 70 ? "text-rust" : item.riskScore >= 40 ? "text-amber" : "text-muted"
              }`}
            />
            <span className="font-mono text-xs font-medium text-foreground">
              {item.riskScore}
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-border">
            <div
              className={`h-1 rounded-full ${
                item.riskScore >= 70 ? "bg-rust" : item.riskScore >= 40 ? "bg-amber" : "bg-muted"
              }`}
              style={{ width: `${item.riskScore}%` }}
            />
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col gap-1">
          <span className="font-medium text-foreground">{item.hotspot}</span>
          <span className="font-mono text-xs text-muted">{item.filePath}</span>
          <span className="text-xs text-secondary">{item.detail}</span>
        </div>

        {/* Age + expand icon */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="whitespace-nowrap text-xs text-muted">{item.agingDebt}</span>
          <Info
            className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""} text-muted`}
            aria-hidden="true"
          />
        </div>
      </button>

      {/* Expanded evidence panel */}
      {isExpanded && item.evidence.length > 0 && (
        <div className="border-t border-border px-3 pb-3 pt-2">
          <p className="mb-2 text-xs font-medium text-secondary">Evidence</p>
          <div className="grid grid-cols-2 gap-2">
            {item.evidence.map((ev, i) => (
              <div
                key={i}
                className="rounded-sm bg-raised px-2.5 py-1.5"
              >
                <span className="font-mono text-xs text-foreground">{ev.value}</span>
                <span className="ml-1.5 text-[11px] text-muted">{ev.metric}</span>
                <p className="text-[11px] text-muted/80">{ev.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}