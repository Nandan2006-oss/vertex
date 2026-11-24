import { useState, useMemo, useEffect } from "react";
import {
  Search,
  X,
  Crosshair,
  FileCode,
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { useAnalysis, useWorkspaceNav } from "../../analysis/AnalysisContext";
import { ArchitectureGraph } from "../../components/ArchitectureGraph";
import { EmptyState } from "../EmptyState";
import type { ServiceState } from "../../analysis/types";

export function ArchitectureScreen() {
  const analysis = useAnalysis();
  const { selectedEntity, setSelectedEntity } = useWorkspaceNav();
  const {
    services,
    dependencies,
    internalDependencies,
    sourceFiles,
    moduleRisks,
  } = analysis;

  const [selectedModule, setSelectedModule] = useState<string | null>(selectedEntity);
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | ServiceState>("all");
  const [isolateMode, setIsolateMode] = useState(false);
  const [fileSearchQuery, setFileSearchQuery] = useState("");

  // Sync external navigation entity
  useEffect(() => {
    if (selectedEntity) {
      // Check if matches a service
      const found = services.find((s) => s.id === selectedEntity || s.name === selectedEntity);
      if (found) {
        setSelectedModule(found.id);
      }
    }
  }, [selectedEntity, services]);

  const totalDeps = dependencies.length;
  const totalInternalEdges = internalDependencies.length;

  // Compute module statistics from REAL dependency data
  const moduleStats = useMemo(() => {
    return services.map((svc) => {
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

      const validComplexities = svcFiles
        .map((f) => f.complexityEstimate)
        .filter((c): c is number => c !== null);
      const avgComplexity =
        validComplexities.length > 0
          ? Math.round(
              validComplexities.reduce((s, c) => s + c, 0) / validComplexities.length,
            )
          : 0;

      return {
        id: svc.id,
        name: svc.name,
        state: svc.state,
        loc: svcLoc > 0 ? svcLoc : svc.loc,
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
  }, [services, dependencies, internalDependencies, sourceFiles]);

  const highFanIn = useMemo(
    () =>
      [...moduleStats]
        .filter((m) => m.fanIn >= 1)
        .sort((a, b) => b.fanIn - a.fanIn)
        .slice(0, 4),
    [moduleStats],
  );

  const highFanOut = useMemo(
    () =>
      [...moduleStats]
        .filter((m) => m.fanOut >= 1)
        .sort((a, b) => b.fanOut - a.fanOut)
        .slice(0, 4),
    [moduleStats],
  );

  // Selected module details
  const selectedDetail = useMemo(
    () => (selectedModule ? moduleStats.find((m) => m.id === selectedModule || m.name === selectedModule) : null),
    [selectedModule, moduleStats],
  );

  const selectedRisk = useMemo(
    () =>
      selectedModule
        ? moduleRisks.find((r) => r.moduleName === selectedModule || r.moduleName === selectedDetail?.name)
        : null,
    [selectedModule, moduleRisks, selectedDetail],
  );

  const selectedDepsFrom = useMemo(
    () =>
      selectedModule
        ? dependencies.filter((d) => d.from === selectedModule || d.from === selectedDetail?.id)
        : [],
    [selectedModule, dependencies, selectedDetail],
  );

  const selectedDepsTo = useMemo(
    () =>
      selectedModule
        ? dependencies.filter((d) => d.to === selectedModule || d.to === selectedDetail?.id)
        : [],
    [selectedModule, dependencies, selectedDetail],
  );

  // Filtered files in selected module
  const filteredFilesInModule = useMemo(() => {
    if (!selectedDetail) return [];
    if (!fileSearchQuery.trim()) return selectedDetail.files;
    const q = fileSearchQuery.toLowerCase();
    return selectedDetail.files.filter((f) => f.toLowerCase().includes(q));
  }, [selectedDetail, fileSearchQuery]);

  if (services.length === 0) {
    return (
      <EmptyState
        title="Architecture data unavailable"
        body="No modules could be identified. Modules are derived from repository directory structure and import relationships."
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 min-w-0">
      {/* Top Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface p-2.5 shadow-2xs">
        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Filter modules by name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xs border border-border bg-raised/50 py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted focus:border-accent/50 focus:outline-hidden transition-colors"
          />
        </div>

        {/* State Filter Tabs */}
        <div className="flex items-center gap-1 rounded-xs border border-border bg-raised/40 p-0.5">
          {(["all", "healthy", "evolving", "at-risk"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStateFilter(st)}
              className={`cursor-pointer rounded-xs px-2.5 py-1 text-xs capitalize transition-all ${
                stateFilter === st
                  ? "bg-surface text-foreground font-semibold shadow-2xs"
                  : "text-muted hover:text-secondary"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Quick Hub Jump Chips */}
        <div className="hidden xl:flex items-center gap-2 text-xs text-muted">
          <span className="text-[11px] font-mono">Hubs:</span>
          {highFanIn.slice(0, 2).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedModule(m.id)}
              className="cursor-pointer rounded-xs border border-border bg-raised/30 px-2 py-0.5 font-mono text-[11px] text-secondary hover:border-accent/40 hover:text-foreground transition-colors"
            >
              ↓ {m.name} ({m.fanIn})
            </button>
          ))}
          {highFanOut.slice(0, 2).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedModule(m.id)}
              className="cursor-pointer rounded-xs border border-border bg-raised/30 px-2 py-0.5 font-mono text-[11px] text-secondary hover:border-accent/40 hover:text-foreground transition-colors"
            >
              ↑ {m.name} ({m.fanOut})
            </button>
          ))}
        </div>
      </div>

      {/* Main Canvas Area + Slide-over Inspector */}
      <div className="flex flex-1 gap-4 min-h-[560px] relative">
        {/* Left: Interactive Graph Visualization Canvas */}
        <div className="flex flex-1 min-w-0 flex-col">
          <ArchitectureGraph
            services={services}
            dependencies={dependencies}
            height={560}
            selectedModuleId={selectedModule}
            onSelectModule={(id) => {
              setSelectedModule(id);
              setSelectedEntity(id);
            }}
            searchQuery={searchQuery}
            filterState={stateFilter}
            isolateSelected={isolateMode}
            onToggleIsolate={() => setIsolateMode((prev) => !prev)}
            className="flex-1"
          />
        </div>

        {/* Right: Docked / Slide-over Detail Inspector */}
        {selectedDetail && (
          <div className="w-80 lg:w-96 shrink-0 rounded-md border border-border bg-surface p-4 flex flex-col gap-4 shadow-xl overflow-y-auto max-h-[560px] animate-fade-in">
            {/* Header with State & Close */}
            <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                      selectedDetail.state === "healthy"
                        ? "bg-emerald"
                        : selectedDetail.state === "evolving"
                          ? "bg-amber"
                          : "bg-rust"
                    }`}
                  />
                  <h3 className="font-mono text-sm font-bold text-foreground truncate">
                    {selectedDetail.name}
                  </h3>
                </div>
                <span className="text-[11px] text-muted capitalize font-mono mt-0.5">
                  Status: {selectedDetail.state}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedModule(null);
                  setSelectedEntity(null);
                }}
                className="cursor-pointer rounded-xs p-1 text-muted hover:bg-raised hover:text-foreground transition-colors"
                aria-label="Close inspector panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Action: Isolate Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsolateMode((prev) => !prev)}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-xs border px-3 py-1.5 text-xs font-medium transition-colors ${
                isolateMode
                  ? "border-accent bg-accent text-white"
                  : "border-border bg-raised/50 text-secondary hover:bg-raised hover:text-foreground"
              }`}
            >
              <Crosshair className="h-3.5 w-3.5" />
              <span>{isolateMode ? "Show Full System Graph" : "Isolate Module & Connections"}</span>
            </button>

            {/* Core Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xs border border-border/80 bg-raised/30 p-2">
                <span className="text-[10px] text-muted uppercase font-mono">Lines of Code</span>
                <p className="font-mono text-sm font-semibold text-foreground mt-0.5">
                  {selectedDetail.loc.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xs border border-border/80 bg-raised/30 p-2">
                <span className="text-[10px] text-muted uppercase font-mono">Files in Module</span>
                <p className="font-mono text-sm font-semibold text-foreground mt-0.5">
                  {selectedDetail.fileCount}
                </p>
              </div>
              <div className="rounded-xs border border-border/80 bg-raised/30 p-2">
                <span className="text-[10px] text-muted uppercase font-mono">Fan-In (Dependents)</span>
                <p className="font-mono text-sm font-semibold text-foreground mt-0.5">
                  {selectedDetail.fanIn} inbound
                </p>
              </div>
              <div className="rounded-xs border border-border/80 bg-raised/30 p-2">
                <span className="text-[10px] text-muted uppercase font-mono">Fan-Out (Dependencies)</span>
                <p className="font-mono text-sm font-semibold text-foreground mt-0.5">
                  {selectedDetail.fanOut} outbound
                </p>
              </div>
            </div>

            {/* Risk Factor Breakdown */}
            {selectedRisk && (
              <div className="flex flex-col gap-2 rounded-xs border border-border/80 bg-raised/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Risk Assessment</span>
                  <span
                    className={`font-mono text-xs font-bold ${
                      selectedRisk.riskScore > 60
                        ? "text-rust"
                        : selectedRisk.riskScore > 35
                          ? "text-amber"
                          : "text-emerald"
                    }`}
                  >
                    {selectedRisk.riskScore}/100
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      selectedRisk.riskScore > 60
                        ? "bg-rust"
                        : selectedRisk.riskScore > 35
                          ? "bg-amber"
                          : "bg-emerald"
                    }`}
                    style={{ width: `${Math.min(100, selectedRisk.riskScore)}%` }}
                  />
                </div>
                {selectedRisk.factors && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {selectedRisk.factors
                      .filter((f) => f.contribution > 0)
                      .slice(0, 4)
                      .map((f, i) => (
                        <span
                          key={i}
                          title={f.evidence.explanation}
                          className="rounded-xs bg-surface border border-border px-1.5 py-0.5 text-[10px] font-mono text-muted"
                        >
                          {f.name}: +{f.contribution}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Inbound Dependents (Fan-In) */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ArrowDownRight className="h-3.5 w-3.5 text-accent" />
                Dependents ({selectedDepsTo.length})
              </span>
              {selectedDepsTo.length === 0 ? (
                <span className="text-[11px] text-muted italic">No inbound module dependencies</span>
              ) : (
                <div className="flex flex-col gap-1 max-h-28 overflow-y-auto">
                  {selectedDepsTo.map((d) => (
                    <button
                      key={d.from}
                      type="button"
                      onClick={() => setSelectedModule(d.from)}
                      className="flex cursor-pointer items-center justify-between rounded-xs bg-raised/40 px-2.5 py-1 text-left text-xs font-mono text-secondary hover:bg-raised hover:text-foreground transition-colors"
                    >
                      <span className="truncate">← {d.from}</span>
                      <ArrowRight className="h-3 w-3 text-muted shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Outbound Dependencies (Fan-Out) */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ArrowUpRight className="h-3.5 w-3.5 text-accent" />
                Dependencies ({selectedDepsFrom.length})
              </span>
              {selectedDepsFrom.length === 0 ? (
                <span className="text-[11px] text-muted italic">No outbound module dependencies</span>
              ) : (
                <div className="flex flex-col gap-1 max-h-28 overflow-y-auto">
                  {selectedDepsFrom.map((d) => (
                    <button
                      key={d.to}
                      type="button"
                      onClick={() => setSelectedModule(d.to)}
                      className="flex cursor-pointer items-center justify-between rounded-xs bg-raised/40 px-2.5 py-1 text-left text-xs font-mono text-secondary hover:bg-raised hover:text-foreground transition-colors"
                    >
                      <span className="truncate">→ {d.to}</span>
                      <ArrowRight className="h-3 w-3 text-muted shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Files in this Module */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileCode className="h-3.5 w-3.5 text-muted" />
                Files ({selectedDetail.files.length})
              </span>
              <input
                type="text"
                placeholder="Search files..."
                value={fileSearchQuery}
                onChange={(e) => setFileSearchQuery(e.target.value)}
                className="w-full rounded-xs border border-border bg-raised/40 px-2 py-1 text-[11px] text-foreground placeholder:text-muted focus:outline-hidden"
              />
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto text-[11px] font-mono text-muted">
                {filteredFilesInModule.slice(0, 30).map((f) => (
                  <span key={f} className="truncate p-1 rounded-xs hover:bg-raised/60 hover:text-foreground">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Summary Bar */}
      <div className="rounded-md border border-border bg-surface px-4 py-2.5 text-xs text-muted flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-foreground">{services.length} Total Modules</span>
          <span>·</span>
          <span>{totalDeps} inter-module dependency edges</span>
          <span>·</span>
          <span>{totalInternalEdges} file-level import relationships</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald" />
          <span>Factual Import AST Extraction</span>
        </div>
      </div>
    </div>
  );
}
