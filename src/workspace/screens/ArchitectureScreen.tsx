import { useState } from "react";
import { useAnalysis } from "../../analysis/AnalysisContext";
import { ArchitectureGraph } from "../../components/ArchitectureGraph";
import { EmptyState } from "../EmptyState";

export function ArchitectureScreen() {
  const analysis = useAnalysis();
  const { services, dependencies, internalDependencies, externalDependencies, sourceFiles, moduleRisks, contributorCount } = analysis;
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
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

    // Complexity from actual file analysis
    const validComplexities = svcFiles
      .map((f) => f.complexityEstimate)
      .filter((c): c is number => c !== null);
    const avgComplexity = validComplexities.length > 0
      ? Math.round(validComplexities.reduce((s, c) => s + c, 0) / validComplexities.length)
      : 0;

    return {
      name: svc.name,
      state: svc.state,
      loc: svcLoc,
      fileCount: filesInModule.length,
      fanOut: depsFrom.length,
      fanIn: depsTo.length,
      internalFromCount: internalFrom.length,
      internalToCount: internalTo.length,
      files: svcFiles.map((f) => f.path),
      complexityEstimate: avgComplexity,
      complexityFiles: validComplexities.length,
    };
  });

  const highFanIn = moduleStats.filter((m) => m.fanIn >= 2).sort((a, b) => b.fanIn - a.fanIn).slice(0, 5);
  const highFanOut = moduleStats.filter((m) => m.fanOut >= 2).sort((a, b) => b.fanOut - a.fanOut).slice(0, 5);
  const hubs = moduleStats.filter((m) => m.fanIn >= 2 && m.fanOut >= 2).slice(0, 5);

  // Detail for selected module
  const selectedDetail = selectedModule
    ? moduleStats.find((m) => m.name === selectedModule)
    : null;
  const selectedRisk = selectedModule
    ? moduleRisks.find((r) => r.moduleName === selectedModule)
    : null;
  const selectedDepsFrom = selectedModule
    ? dependencies.filter((d) => d.from === selectedModule)
    : [];
  const selectedDepsTo = selectedModule
    ? dependencies.filter((d) => d.to === selectedModule)
    : [];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="text-sm text-secondary">
        Module structure built from real dependency relationships. Each node is a module; edges represent import/include relationships.
        {services.length > 30 && (
          <span className="ml-2 text-xs text-amber">Showing {services.length} modules — large graph.</span>
        )}
      </p>

      {/* Coverage / data summary */}
      <div className="rounded-sm border border-border bg-surface px-4 py-2 text-xs text-muted">
        {services.length > 0 ? (
          <span>
            {services.length} module{services.length !== 1 ? "s" : ""} ·{" "}
            {totalDeps > 0 ? `${totalDeps} module edge(s)` : "No module-level dependency edges"} ·{" "}
            {totalInternalEdges > 0 ? `${totalInternalEdges} internal file relationship(s)` : "No file-level imports detected"} ·{" "}
            {totalExternalLibs > 0 ? `${totalExternalLibs} external libraries` : "No external dependencies"} ·{" "}
            {contributorCount > 0 ? `${contributorCount} contributor(s)` : "Contributors: Unavailable"}
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
        <div className="flex flex-1 gap-6">
          {/* Left: Graph + details */}
          <div className="flex min-w-0 flex-1 flex-col gap-6">
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
                        <button
                          key={m.name}
                          type="button"
                          onClick={() => setSelectedModule(m.name === selectedModule ? null : m.name)}
                          className={`flex cursor-pointer items-center justify-between rounded-sm px-1.5 py-1 text-left transition-colors hover:bg-raised ${
                            selectedModule === m.name ? "bg-raised" : ""
                          }`}
                        >
                          <span className="font-mono text-xs text-foreground">{m.name}</span>
                          <span className="font-mono text-xs text-muted">{m.fanIn} inbound</span>
                        </button>
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
                        <button
                          key={m.name}
                          type="button"
                          onClick={() => setSelectedModule(m.name === selectedModule ? null : m.name)}
                          className={`flex cursor-pointer items-center justify-between rounded-sm px-1.5 py-1 text-left transition-colors hover:bg-raised ${
                            selectedModule === m.name ? "bg-raised" : ""
                          }`}
                        >
                          <span className="font-mono text-xs text-foreground">{m.name}</span>
                          <span className="font-mono text-xs text-muted">{m.fanOut} outbound</span>
                        </button>
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
                        <button
                          key={m.name}
                          type="button"
                          onClick={() => setSelectedModule(m.name === selectedModule ? null : m.name)}
                          className={`flex cursor-pointer items-center justify-between rounded-sm px-1.5 py-1 text-left transition-colors hover:bg-raised ${
                            selectedModule === m.name ? "bg-raised" : ""
                          }`}
                        >
                          <span className="font-mono text-xs text-foreground">{m.name}</span>
                          <span className="font-mono text-xs text-muted">{m.fanIn} in / {m.fanOut} out</span>
                        </button>
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
                  <button
                    key={m.name}
                    type="button"
                    onClick={() => setSelectedModule(m.name === selectedModule ? null : m.name)}
                    className={`cursor-pointer rounded-sm border px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface ${
                      selectedModule === m.name
                        ? "border-foreground/30 bg-raised"
                        : "border-border bg-surface"
                    }`}
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
                        {m.complexityEstimate > 0 && <span>Complexity: {m.complexityEstimate}</span>}
                      </div>
                    </div>
                    {m.internalFromCount > 0 && (
                      <p className="mt-1 text-[11px] text-muted">
                        {m.internalFromCount} internal import relationship{m.internalFromCount !== 1 ? "s" : ""}
                        {m.internalToCount > 0 ? ` · ${m.internalToCount} internal dependents` : ""}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* No dep edges section — explain why */}
            {totalInternalEdges === 0 && totalExternalLibs === 0 && services.length > 0 && (
              <div className="rounded-sm border border-border bg-surface px-4 py-3">
                <p className="text-xs text-muted">
                  No dependency relationships could be established. The discovered modules ({services.length}) are shown above.
                  Dependencies are derived from import/include statements in source files. If the repository uses unsupported
                  languages or has no cross-module imports, no edges will appear.
                </p>
              </div>
            )}
          </div>

          {/* Right: Selected module detail panel */}
          {selectedDetail && (
            <div className="w-72 shrink-0 rounded-sm border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${
                    selectedDetail.state === "healthy" ? "bg-emerald" :
                    selectedDetail.state === "evolving" ? "bg-amber" : "bg-rust"
                  }`} />
                  <h3 className="font-mono text-xs font-medium text-foreground">{selectedDetail.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedModule(null)}
                  className="cursor-pointer text-xs text-muted hover:text-secondary"
                  aria-label="Close detail panel"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <DetailRow label="Files" value={`${selectedDetail.fileCount}`} />
                <DetailRow label="Lines of code" value={`${selectedDetail.loc.toLocaleString()}`} />
                <DetailRow
                  label="Structural complexity estimate"
                  value={selectedDetail.complexityEstimate > 0
                    ? `${selectedDetail.complexityEstimate} (across ${selectedDetail.complexityFiles} file(s))`
                    : "Unavailable"
                  }
                />
                <DetailRow
                  label="Fan-in (dependents)"
                  value={selectedDetail.fanIn > 0 ? `${selectedDetail.fanIn}` : "0"}
                />
                <DetailRow
                  label="Fan-out (dependencies)"
                  value={selectedDetail.fanOut > 0 ? `${selectedDetail.fanOut}` : "0"}
                />

                {/* Risk score from real metrics */}
                {selectedRisk && (
                  <>
                    <div className="my-1 border-t border-border" />
                    <DetailRow label="Risk score (heuristic)" value={`${selectedRisk.riskScore}/100`} />
                    <DetailRow
                      label="Churn (commit count)"
                      value={`${selectedRisk.churn}`}
                    />
                    <DetailRow
                      label="Contributors"
                      value={selectedRisk.contributorCount > 0
                        ? `${selectedRisk.contributorCount}`
                        : "Unavailable"
                      }
                    />
                    {selectedRisk.reasons.length > 0 && (
                      <div className="mt-1">
                        <span className="text-[11px] text-secondary">Evidence:</span>
                        <ul className="mt-1 flex flex-col gap-1">
                          {selectedRisk.reasons.slice(0, 4).map((r, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted">
                              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                {/* Factor breakdown */}
                {selectedRisk && selectedRisk.factors.filter((f) => f.contribution > 0).length > 0 && (
                  <div className="mt-1">
                    <div className="my-1 border-t border-border" />
                    <span className="text-[11px] text-secondary">Risk factors (heuristic weights):</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {selectedRisk.factors
                        .filter((f) => f.contribution > 0)
                        .slice(0, 5)
                        .map((f, i) => (
                          <span
                            key={i}
                            title={f.evidence.explanation}
                            className="rounded-sm bg-raised px-1.5 py-0.5 text-[10px] text-muted"
                          >
                            {f.name}: +{f.contribution}
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                {/* Files in this module */}
                {selectedDetail.files.length > 0 && (
                  <div className="mt-1">
                    <div className="my-1 border-t border-border" />
                    <span className="text-[11px] text-secondary">Files ({selectedDetail.files.length}):</span>
                    <div className="mt-1 flex max-h-40 flex-col gap-0.5 overflow-y-auto">
                      {selectedDetail.files.map((f) => (
                        <span key={f} className="font-mono text-[10px] text-muted">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dependencies from this module */}
                {selectedDepsFrom.length > 0 && (
                  <div className="mt-1">
                    <div className="my-1 border-t border-border" />
                    <span className="text-[11px] text-secondary">Dependencies:</span>
                    <div className="mt-1 flex flex-col gap-0.5">
                      {selectedDepsFrom.map((d) => (
                        <span key={d.to} className="font-mono text-[10px] text-muted">
                          → {d.to}
                          {d.reason && <span className="ml-1 text-muted/70">({d.reason})</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dependents */}
                {selectedDepsTo.length > 0 && (
                  <div className="mt-1">
                    <div className="my-1 border-t border-border" />
                    <span className="text-[11px] text-secondary">Depended on by:</span>
                    <div className="mt-1 flex flex-col gap-0.5">
                      {selectedDepsTo.map((d) => (
                        <span key={d.from} className="font-mono text-[10px] text-muted">
                          ← {d.from}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[11px] text-secondary shrink-0">{label}</span>
      <span className="text-right font-mono text-[11px] text-foreground">{value}</span>
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