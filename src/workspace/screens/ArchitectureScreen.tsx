import { useAnalysis } from "../../analysis/AnalysisContext";
import { ArchitectureGraph } from "../../components/ArchitectureGraph";
import { EmptyState } from "../EmptyState";

export function ArchitectureScreen() {
  const analysis = useAnalysis();
  const { services, dependencies } = analysis;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="text-sm text-secondary">
        Force-directed graph of the module structure. Node color = health state.
        Hover or focus a node for details.
      </p>

      {services.length === 0 || dependencies.length === 0 ? (
        <EmptyState
          title="No modules mapped yet"
          body="Modules are derived from your repository's top-level directories. Repositories with a single flat structure may show fewer nodes."
        />
      ) : (
        <>
          {/* Legend */}
          <div className="flex items-center gap-6">
            <LegendDot color="emerald" label="Healthy" />
            <LegendDot color="amber" label="Evolving" />
            <LegendDot color="rust" label="At risk" />
          </div>

          {/* Graph */}
          <div className="flex-1 rounded-sm border border-border bg-surface p-2">
            <ArchitectureGraph
              services={services}
              dependencies={dependencies}
              height={480}
            />
          </div>
        </>
      )}
    </div>
  );
}

const DOT_STYLES: Record<"emerald" | "amber" | "rust", string> = {
  emerald: "bg-emerald",
  amber: "bg-amber",
  rust: "bg-rust",
};

function LegendDot({
  color,
  label,
}: {
  color: "emerald" | "amber" | "rust";
  label: string;
}) {
  return (
    <span className="flex items-center gap-2 text-xs text-secondary">
      <span className={`h-2 w-2 rounded-full ${DOT_STYLES[color]}`} />
      {label}
    </span>
  );
}