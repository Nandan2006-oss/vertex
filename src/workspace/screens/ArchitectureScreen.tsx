import { useAnalysis } from "../../analysis/AnalysisContext";
import { ArchitectureGraph } from "../../components/ArchitectureGraph";
import { EmptyState } from "../EmptyState";

export function ArchitectureScreen() {
  const analysis = useAnalysis();
  const { services, dependencies, internalDependencies, externalDependencies, sourceFiles } = analysis;
  const totalDeps = dependencies.length;
  const totalInternalEdges = internalDependencies.length;
  const totalExternalLibs = externalDependencies.length;

  // Compute module statistics from REAL dependency data
  const moduleStats = services.map((svc) => {
    const filesInModule = svc.files;
    const depsFrom = dependencies.filter((d) => d.from === svc.id);
    const depsTo = dependencies.filter((d) => d.to === svc.id);
    const internalFrom = internalDependencies.filter((d) =>
      filesInModule.some((f) => d.from === f || d.from.startsWith(svc.id)),
    );
    const internalTo = internalDependencies.filter((d) =>
      filesInModule.some((f) => d.to === f || d.to.startsWith(svc.id)),
    );
    const svcFiles = sourceFiles.filter((f) =>
      filesInModule.some((mf) => f.path === mf || f.path.startsWith(svc.id)),
    );
    const svcLoc = svcFiles.reduce((s, f) => s + (f.loc ?? 0), 0);
    return {
      name: svc.name,
      state: svc.state,
      loc: svcLoc,
      fileCount: filesInModule.length,
      fanOut: depsFrom.length,
      fanIn: depsTo.length,
      internalFromCount: internalFrom.length,
      internalToCount: internalTo.length,
    };
  });

  const highFanIn = moduleStats.filter((m) => m.fanIn >= 2).sort((a, b) => b.fanIn - a.fanIn).slice(0, 5);
  const highFanOut = moduleStats.filter((m) => m.fanOut >= 2).sort((a, b) => b.fanOut - a.fanOut).slice(0, 5);
  const hubs = moduleStats.filter((m) => m.fanIn >= 2 && m.fanOut >= 2).slice(0, 5);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="text-sm text-secondary">
        Module structure built from real dependency relationships. Each node is a module; edges represent import/include relationships.
      </p>

      {/* Coverage / data summary */}
      <div className="rounded-sm border border-border bg-surface px-4 py-2 text-xs text-muted">
        {services.length > 0 ? (
          <span>
            {services.length} module{services.length !== 1 ? "s" : ""} ·{" "}
            {totalDeps > 0 ? `${totalDeps} module edge(s)` : "No module-level dependency edges"} ·{" "}
            {totalInternalEdges > 0 ? `${totalInternalEdges} internal file relationship(s)` : "No file-level imports detected"} ·{" "}
            {totalExternalLibs > 0 ? `${totalExternalLibs} external libraries` : "No external dependencies"}
          </span>
        ) : (
          <span>Architecture data unavailable or incomplete.</span>
        )}
      </div>

      {services.length === 0 ? (
        <EmptyState
          title="Architecture data unavailable"
          body="No modules could be identified. Modules are derived from the repository's directory structure and dependency relationships."
        />
      ) : (
        <>
          {/* Graph */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-6">
              <LegendDot color="emerald" label="Healthy" />
              <LegendDot color="amber" label="Evolving" />
              <LegendDot color="rust" label="At risk" />
            </div>
            <div className="rounded-sm border border-border bg-surface p-2">
              <ArchitectureGraph
                services={services}
                dependencies={dependencies}
                height={480}
              />
            </div>
          </div>

          {/* Module details section — show only when we have real data */}
          {internalDependencies.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {highFanIn.length > 0 && (
                <div className="rounded-sm border border-border bg-surface px-4 py-3">
                  <h3 className="mb-2 text-xs font-medium text-secondary">Most depended-upon modules</h3>
                  <p className="mb-2 text-[11px] text-muted">High fan-in — changes affect many dependents</p>
                  <div className="flex flex-col gap-1.5">
                    {highFanIn.map((m) => (
                      <div key={m.name} className="flex items-center justify-between">
                        <span className="font-mono text-xs text-foreground">{m.name}</span>
                        <span className="font-mono text-xs text-muted">{m.fanIn} inbound</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {highFanOut.length > 0 && (
                <div className="rounded-sm border border-border bg-surface px-4 py-3">
                  <h3 className="mb-2 text-xs font-medium text-secondary">Highest fan-out</h3>
                  <p className="mb-2 text-[11px] text-muted">Modules with many outbound dependencies</p>
                  <div className="flex flex-col gap-1.5">
                    {highFanOut.map((m) => (
                      <div key={m.name} className="flex items-center justify-between">
                        <span className="font-mono text-xs text-foreground">{m.name}</span>
                        <span className="font-mono text-xs text-muted">{m.fanOut} outbound</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {hubs.length > 0 && (
                <div className="rounded-sm border border-border bg-surface px-4 py-3">
                  <h3 className="mb-2 text-xs font-medium text-secondary">Dependency hubs</h3>
                  <p className="mb-2 text-[11px] text-muted">High fan-in AND fan-out — central modules</p>
                  <div className="flex flex-col gap-1.5">
                    {hubs.map((m) => (
                      <div key={m.name} className="flex items-center justify-between">
                        <span className="font-mono text-xs text-foreground">{m.name}</span>
                        <span className="font-mono text-xs text-muted">{m.fanIn} in / {m.fanOut} out</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Per-module detail */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-secondary">Module details</h3>
            <div className="flex flex-col gap-1">
              {moduleStats.map((m) => (
                <div
                  key={m.name}
                  className="rounded-sm border border-border bg-surface px-3 py-2.5 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${
                        m.state === "healthy" ? "bg-emerald" :
                        m.state === "evolving" ? "bg-amber" : "bg-rust"
                      }`} />
                      <span className="font-mono text-xs font-medium text-foreground">{m.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted">
                      <span>{m.fileCount} file{m.fileCount !== 1 ? "s" : ""}</span>
                      <span>{m.loc.toLocaleString()} LOC</span>
                      {m.fanIn > 0 && <span>{m.fanIn} inbound</span>}
                      {m.fanOut > 0 && <span>{m.fanOut} outbound</span>}
                    </div>
                  </div>
                  {m.internalFromCount > 0 && (
                    <p className="mt-1 text-[11px] text-muted">
                      {m.internalFromCount} internal import relationship{m.internalFromCount !== 1 ? "s" : ""}
                      {m.internalToCount > 0 ? ` · ${m.internalToCount} internal dependents` : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
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