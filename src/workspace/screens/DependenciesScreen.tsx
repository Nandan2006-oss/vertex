import { useState, useMemo } from "react";
import {
  Search,
  ArrowLeftRight,
  FileCode,
  Network,
  List,
  Package,
} from "lucide-react";
import { useAnalysis, useWorkspaceNav } from "../../analysis/AnalysisContext";
import { FileDependencyGraph } from "../../components/FileDependencyGraph";
import { ExternalDependencyGraph } from "../../components/ExternalDependencyGraph";
import { CircularDependencyGraph } from "../../components/CircularDependencyGraph";

type Tab = "internal" | "external" | "circular";
type ViewMode = "graph" | "list";

export function DependenciesScreen() {
  const analysis = useAnalysis();
  const { navigateToScreen } = useWorkspaceNav();
  const {
    internalDependencies,
    externalDependencies,
    circularDependencies,
  } = analysis;

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>(circularDependencies.length > 0 ? "circular" : "internal");
  const [viewMode, setViewMode] = useState<ViewMode>("graph");
  const [sortKey, setSortKey] = useState<"from" | "to">("from");

  const filteredInternal = useMemo(() => {
    let list = [...internalDependencies];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (d) =>
          d.from.toLowerCase().includes(q) ||
          d.to.toLowerCase().includes(q) ||
          d.evidence.toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => a[sortKey].localeCompare(b[sortKey]));
  }, [query, internalDependencies, sortKey]);

  const filteredExternal = useMemo(() => {
    if (!query.trim()) return externalDependencies;
    const q = query.toLowerCase();
    return externalDependencies.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.imports.some((f) => f.toLowerCase().includes(q)),
    );
  }, [query, externalDependencies]);

  return (
    <div className="flex flex-1 flex-col gap-4 min-w-0">
      {/* Top Workspace Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface p-2.5 shadow-2xs">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 rounded-xs border border-border bg-raised/40 p-0.5">
          <button
            type="button"
            onClick={() => setTab("internal")}
            className={`cursor-pointer rounded-xs px-3 py-1.5 text-xs font-medium transition-all ${
              tab === "internal"
                ? "bg-surface text-foreground font-semibold shadow-2xs"
                : "text-muted hover:text-secondary"
            }`}
          >
            Internal Imports ({internalDependencies.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("external")}
            className={`cursor-pointer rounded-xs px-3 py-1.5 text-xs font-medium transition-all ${
              tab === "external"
                ? "bg-surface text-foreground font-semibold shadow-2xs"
                : "text-muted hover:text-secondary"
            }`}
          >
            External Packages ({externalDependencies.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("circular")}
            className={`flex items-center gap-1.5 cursor-pointer rounded-xs px-3 py-1.5 text-xs font-medium transition-all ${
              tab === "circular"
                ? "bg-surface text-foreground font-semibold shadow-2xs"
                : "text-muted hover:text-secondary"
            }`}
          >
            {circularDependencies.length > 0 && (
              <span className="flex h-2 w-2 rounded-full bg-rust animate-pulse" />
            )}
            <span>Circular Cycles</span>
            <span
              className={`rounded-xs font-mono text-[10px] px-1 py-0.2 ${
                circularDependencies.length > 0
                  ? "bg-rust/20 text-rust font-bold"
                  : "bg-raised text-muted"
              }`}
            >
              {circularDependencies.length}
            </span>
          </button>
        </div>

        {/* View Switcher & Search Bar */}
        <div className="flex items-center gap-2.5 ml-auto">
          {/* Graph vs List View Toggle */}
          <div className="flex items-center gap-0.5 rounded-xs border border-border bg-raised/40 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("graph")}
              title="Interactive Visual Graph View"
              className={`flex cursor-pointer items-center gap-1.5 rounded-xs px-2.5 py-1 text-xs font-medium transition-all ${
                viewMode === "graph"
                  ? "bg-surface text-foreground font-semibold shadow-2xs"
                  : "text-muted hover:text-secondary"
              }`}
            >
              <Network className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Graph</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              title="Structured Data Table View"
              className={`flex cursor-pointer items-center gap-1.5 rounded-xs px-2.5 py-1 text-xs font-medium transition-all ${
                viewMode === "list"
                  ? "bg-surface text-foreground font-semibold shadow-2xs"
                  : "text-muted hover:text-secondary"
              }`}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Table</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-56 sm:w-64">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              placeholder="Search dependencies or AST lines…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xs border border-border bg-raised/50 py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted focus:border-accent/50 focus:outline-hidden transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Tab Content Panes */}
      {tab === "internal" && (
        <div className="flex flex-1 flex-col gap-3 min-h-[560px]">
          {viewMode === "graph" ? (
            <div className="flex-1 min-h-[560px]">
              <FileDependencyGraph
                dependencies={filteredInternal}
                searchQuery={query}
                height={580}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-muted mb-2">
                <span>
                  Showing {filteredInternal.length} of {internalDependencies.length} internal import relationships
                </span>
                <div className="flex items-center gap-2">
                  <span>Sort by:</span>
                  <button
                    type="button"
                    onClick={() => setSortKey("from")}
                    className={`cursor-pointer rounded-xs px-2 py-0.5 font-mono text-[11px] ${
                      sortKey === "from" ? "bg-accent/20 text-accent font-bold" : "hover:text-foreground"
                    }`}
                  >
                    Consumer (From)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortKey("to")}
                    className={`cursor-pointer rounded-xs px-2 py-0.5 font-mono text-[11px] ${
                      sortKey === "to" ? "bg-accent/20 text-accent font-bold" : "hover:text-foreground"
                    }`}
                  >
                    Target (To)
                  </button>
                </div>
              </div>

              {filteredInternal.length === 0 ? (
                <p className="text-xs text-muted py-6 text-center">No dependencies match &ldquo;{query}&rdquo;.</p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-[520px] overflow-y-auto">
                  {filteredInternal.slice(0, 150).map((dep, i) => (
                    <div
                      key={`int-${i}`}
                      className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-xs border border-border/80 bg-raised/30 p-2.5 text-xs transition-colors hover:border-accent/40 hover:bg-raised"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <FileCode className="h-3.5 w-3.5 text-muted shrink-0 group-hover:text-accent" />
                        <span className="font-mono text-foreground font-medium truncate max-w-[280px]">
                          {dep.from}
                        </span>
                        <ArrowLeftRight className="h-3 w-3 text-muted shrink-0" />
                        <span className="font-mono text-secondary font-medium truncate max-w-[280px]">
                          {dep.to}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-muted/90 bg-surface px-2 py-1 rounded-xs border border-border/60 max-w-sm truncate">
                        {dep.evidence}
                      </div>
                    </div>
                  ))}
                  {filteredInternal.length > 150 && (
                    <p className="text-center font-mono text-xs text-muted py-2">
                      Showing first 150 of {filteredInternal.length} records. Refine search query for specific files.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "external" && (
        <div className="flex flex-1 flex-col gap-3 min-h-[560px]">
          {viewMode === "graph" ? (
            <div className="flex-1 min-h-[560px]">
              <ExternalDependencyGraph
                dependencies={filteredExternal}
                searchQuery={query}
                height={580}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredExternal.map((pkg) => (
                <div
                  key={pkg.name}
                  className="rounded-md border border-border bg-surface p-3.5 shadow-2xs flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="h-4 w-4 text-accent shrink-0" />
                      <span className="font-mono text-xs font-bold text-foreground truncate">
                        {pkg.name}
                      </span>
                    </div>
                    <span className="rounded-xs bg-raised px-1.5 py-0.5 font-mono text-[10px] text-muted shrink-0">
                      {pkg.imports.length} file{pkg.imports.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {pkg.imports.length > 0 && (
                    <div className="flex flex-col gap-1 max-h-28 overflow-y-auto pt-1">
                      <span className="text-[10px] text-muted uppercase font-mono">Imported by:</span>
                      {pkg.imports.slice(0, 15).map((f) => (
                        <span key={f} className="font-mono text-[10px] text-secondary truncate">
                          • {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "circular" && (
        <div className="flex flex-1 flex-col gap-4">
          <CircularDependencyGraph
            cycles={circularDependencies}
            onSelectFile={(f) => navigateToScreen("architecture", f)}
          />
        </div>
      )}
    </div>
  );
}
