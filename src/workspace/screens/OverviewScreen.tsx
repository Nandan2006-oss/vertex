import { useMemo } from "react";
import {
  Code2,
  Share2,
  ArrowLeftRight,
  AlertTriangle,
  GitCommit,
  Users,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Activity,
  Boxes,
  Clock,
  Sparkles,
} from "lucide-react";
import { useAnalysis, useWorkspaceNav } from "../../analysis/AnalysisContext";
import { EmptyState } from "../EmptyState";
import { getLanguageColor } from "../../analysis/languages";

export function OverviewScreen() {
  const analysis = useAnalysis();
  const { navigateToScreen } = useWorkspaceNav();

  const {
    services,
    metrics,
    commits,
    commitCount,
    totalLines,
    languages,
    sourceFiles,
    framework,
    classifiedFiles,
    evidence,
    moduleRisks,
    fileCount,
    coverage,
    internalDependencies,
    externalDependencies,
    circularDependencies,
    contributors,
  } = analysis;

  const derived = useMemo(() => {
    const sourceCount = sourceFiles.length;
    const testCount = classifiedFiles.find((c) => c.category === "test")?.count ?? 0;
    const configCount = classifiedFiles.find((c) => c.category === "config")?.count ?? 0;
    const docCount = classifiedFiles.find((c) => c.category === "documentation")?.count ?? 0;

    const healthyCount = services.filter((s) => s.state === "healthy").length;
    const evolvingCount = services.filter((s) => s.state === "evolving").length;
    const atRiskCount = services.filter((s) => s.state === "at-risk").length;

    const topRisky = [...moduleRisks].sort((a, b) => b.riskScore - a.riskScore).slice(0, 4);

    // Most connected modules (Hubs)
    const connectedModules = services
      .map((s) => {
        const fanIn = analysis.dependencies.filter((d) => d.to === s.id).length;
        const fanOut = analysis.dependencies.filter((d) => d.from === s.id).length;
        return {
          id: s.id,
          name: s.name,
          state: s.state,
          loc: s.loc,
          fanIn,
          fanOut,
          totalDegree: fanIn + fanOut,
        };
      })
      .sort((a, b) => b.totalDegree - a.totalDegree)
      .slice(0, 4);

    // Activity metrics
    const avgDailyCommits =
      metrics.commitActivity.length > 0
        ? Math.round(
            (metrics.commitActivity.reduce((s, p) => s + p.value, 0) /
              metrics.commitActivity.length) *
              10,
          ) / 10
        : 0;

    // Top contributor
    const topContributor = contributors.length > 0 ? contributors[0] : null;

    return {
      sourceCount,
      testCount,
      configCount,
      docCount,
      healthyCount,
      evolvingCount,
      atRiskCount,
      topRisky,
      connectedModules,
      avgDailyCommits,
      topContributor,
    };
  }, [analysis, services, sourceFiles, classifiedFiles, moduleRisks, metrics, contributors]);

  if (services.length === 0 && fileCount === 0) {
    return (
      <EmptyState
        title="No analysis data available"
        body="We couldn't extract any source files from this repository. Try choosing a repository with recognized source files."
      />
    );
  }

  const locDisplay =
    totalLines !== null
      ? `${(totalLines / 1000).toFixed(1)}k`
      : `${sourceFiles.length} files`;
  const locPerFile =
    totalLines !== null && derived.sourceCount > 0
      ? `~${Math.round(totalLines / Math.max(1, derived.sourceCount))} LOC/file`
      : "Exact LOC parsed";

  return (
    <div className="flex flex-col gap-5">
      {/* Top Banner: Repo Profile & Coverage Telemetry */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-md border border-border bg-surface/80 p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-accent-muted text-accent border border-accent/20">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-base font-semibold text-foreground tracking-tight">
                {analysis.name}
              </h1>
              {framework && (
                <span className="rounded-xs border border-border bg-raised px-1.5 py-0.5 font-mono text-[11px] text-secondary">
                  {framework.name} {framework.buildSystem ? `(${framework.buildSystem})` : ""}
                </span>
              )}
            </div>
            <p className="text-xs text-muted">
              {analysis.description || "Client-side architecture & telemetry intelligence"}
            </p>
          </div>
        </div>

        {/* Evidence Status */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 rounded-xs border border-emerald/30 bg-emerald/10 px-2.5 py-1 text-emerald">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="font-medium">Evidence Coverage: {coverage.confidence}</span>
          </div>
          <span className="text-[11px] font-mono text-muted hidden md:inline">
            {coverage.history.label}
          </span>
        </div>
      </div>

      {/* 6 Actionable Telemetry Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Source Scope */}
        <MetricCard
          label="Codebase Volume"
          value={locDisplay}
          unit={totalLines !== null ? "Lines" : ""}
          detail={locPerFile}
          icon={Code2}
          onClick={() => navigateToScreen("architecture")}
        />

        {/* Modules & Health */}
        <MetricCard
          label="Discovered Modules"
          value={String(services.length)}
          detail={`${derived.healthyCount} healthy · ${derived.atRiskCount} at-risk`}
          icon={Share2}
          onClick={() => navigateToScreen("architecture")}
          status={derived.atRiskCount > 0 ? "rust" : "emerald"}
        />

        {/* Dependencies */}
        <MetricCard
          label="Dependencies"
          value={String(internalDependencies.length + externalDependencies.length)}
          detail={`${internalDependencies.length} internal · ${externalDependencies.length} pkgs`}
          icon={ArrowLeftRight}
          onClick={() => navigateToScreen("dependencies")}
          status={circularDependencies.length > 0 ? "rust" : undefined}
          badge={circularDependencies.length > 0 ? `${circularDependencies.length} cycle(s)` : undefined}
        />

        {/* Technical Debt */}
        <MetricCard
          label="Tracked Tech Debt"
          value={String(analysis.techDebt.length)}
          detail={
            derived.topRisky.length > 0
              ? `Max risk: ${derived.topRisky[0].riskScore}/100`
              : "No high-risk hotspots"
          }
          icon={AlertTriangle}
          onClick={() => navigateToScreen("tech-debt")}
          status={analysis.techDebt.length > 0 ? "rust" : "emerald"}
        />

        {/* Git Evolution */}
        <MetricCard
          label="Commit History"
          value={String(commitCount)}
          detail={
            commits.length > 0
              ? `Latest: ${commits[0].hash.slice(0, 7)}`
              : "Git history unavailable"
          }
          icon={GitCommit}
          onClick={() => navigateToScreen("history")}
        />

        {/* Contributors */}
        <MetricCard
          label="Contributors"
          value={String(contributors.length)}
          detail={
            derived.topContributor
              ? `Lead: ${derived.topContributor.name} (${derived.topContributor.percentage}%)`
              : "Local authors"
          }
          icon={Users}
          onClick={() => navigateToScreen("history")}
        />
      </div>

      {/* Main Intelligence Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 cols): Architecture Health, Languages, Risky Modules */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* Architecture Health & Language Mix */}
          <div className="rounded-md border border-border bg-surface p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-accent" />
                <h2 className="text-xs font-semibold text-foreground tracking-wide uppercase">
                  Language & File Composition
                </h2>
              </div>
              <span className="text-[11px] text-muted font-mono">
                {derived.sourceCount} source · {derived.testCount} tests · {derived.configCount} config
              </span>
            </div>

            {/* Language Stacked Bar */}
            {languages.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-raised">
                  {languages.slice(0, 8).map((lang, idx) => {
                    const color =
                      lang.color && lang.color !== "#888" && lang.color !== "#888888"
                        ? lang.color
                        : getLanguageColor(lang.name, idx);
                    return (
                      <div
                        key={lang.name}
                        title={`${lang.name}: ${lang.percentage}%`}
                        style={{
                          width: `${lang.percentage}%`,
                          backgroundColor: color,
                        }}
                        className="transition-all hover:opacity-85"
                      />
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
                  {languages.slice(0, 7).map((lang, idx) => {
                    const color =
                      lang.color && lang.color !== "#888" && lang.color !== "#888888"
                        ? lang.color
                        : getLanguageColor(lang.name, idx);
                    return (
                      <span
                        key={lang.name}
                        className="flex items-center gap-1.5 text-xs text-secondary"
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-medium text-foreground">{lang.name}</span>
                        <span className="font-mono text-[11px] text-muted">
                          {lang.percentage}%
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Highest-Risk Modules */}
          <div className="rounded-md border border-border bg-surface p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rust" />
                <h2 className="text-xs font-semibold text-foreground tracking-wide uppercase">
                  Elevated Risk Modules
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigateToScreen("tech-debt")}
                className="flex items-center gap-1 text-[11px] text-accent hover:underline cursor-pointer"
              >
                View all in Tech Debt <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>

            {derived.topRisky.length === 0 ? (
              <p className="text-xs text-muted py-3 text-center">
                No elevated risk modules detected. All evaluated modules score below heuristic risk thresholds.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {derived.topRisky.map((risk) => (
                  <div
                    key={risk.moduleName}
                    onClick={() => navigateToScreen("architecture", risk.moduleName)}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 rounded-sm border border-border/80 bg-raised/40 p-2.5 transition-all hover:border-accent/40 hover:bg-raised cursor-pointer"
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-foreground truncate">
                          {risk.moduleName}
                        </span>
                        {risk.isGodModule && (
                          <span className="rounded-xs bg-amber/15 border border-amber/30 px-1 py-0.2 text-[10px] text-amber font-medium">
                            God Module
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted">
                        {risk.fileCount} files · {risk.loc.toLocaleString()} LOC · Complexity {risk.complexityEstimate}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-24 flex flex-col gap-1">
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-muted">Risk</span>
                          <span
                            className={
                              risk.riskScore > 60
                                ? "text-rust font-bold"
                                : risk.riskScore > 35
                                  ? "text-amber font-medium"
                                  : "text-emerald"
                            }
                          >
                            {risk.riskScore}/100
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-surface overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              risk.riskScore > 60
                                ? "bg-rust"
                                : risk.riskScore > 35
                                  ? "bg-amber"
                                  : "bg-emerald"
                            }`}
                            style={{ width: `${Math.min(100, risk.riskScore)}%` }}
                          />
                        </div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evidence Insights Takeaways */}
          {evidence.length > 0 && (
            <div className="rounded-md border border-border bg-surface p-4 shadow-2xs">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-accent" />
                <h2 className="text-xs font-semibold text-foreground tracking-wide uppercase">
                  Factual Architecture Insights
                </h2>
              </div>
              <div className="flex flex-col gap-2.5">
                {evidence.slice(0, 3).map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-sm border border-border/80 bg-raised/30 p-3 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-foreground">{item.insight}</span>
                      <span className="rounded-xs bg-surface px-1.5 py-0.5 text-[10px] font-mono text-muted border border-border">
                        {item.source}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-0.5 pl-3 list-disc text-[11px] text-muted">
                      {item.facts.slice(0, 2).map((fact, fi) => (
                        <li key={fi}>{fact}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Activity Timeline, Most Connected Hubs, Recent Commits */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Commit Activity Timeline */}
          <div className="rounded-md border border-border bg-surface p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-accent" />
                <h2 className="text-xs font-semibold text-foreground tracking-wide uppercase">
                  Commit Velocity
                </h2>
              </div>
              <span className="font-mono text-[11px] text-muted">
                {derived.avgDailyCommits} commits/active day
              </span>
            </div>

            {metrics.commitActivity.length > 1 ? (
              <div className="flex flex-col gap-2">
                <div className="h-20 w-full">
                  <ActivityChart
                    data={metrics.commitActivity.map((p) => p.value)}
                    color="var(--color-accent)"
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-muted">
                  <span>Earliest recorded</span>
                  <span>Latest activity</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted py-4 text-center">
                Insufficient temporal commit metadata for time series chart.
              </p>
            )}
          </div>

          {/* Central Dependency Hubs */}
          <div className="rounded-md border border-border bg-surface p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-accent" />
                <h2 className="text-xs font-semibold text-foreground tracking-wide uppercase">
                  Key Dependency Hubs
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigateToScreen("architecture")}
                className="flex items-center gap-1 text-[11px] text-accent hover:underline cursor-pointer"
              >
                Inspect in Graph <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>

            {derived.connectedModules.length === 0 ? (
              <p className="text-xs text-muted py-3 text-center">
                No inter-module dependency edges established.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {derived.connectedModules.map((mod) => (
                  <div
                    key={mod.id}
                    onClick={() => navigateToScreen("architecture", mod.name)}
                    className="flex items-center justify-between rounded-sm border border-border/80 bg-raised/40 px-3 py-2 text-xs transition-all hover:border-accent/40 hover:bg-raised cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          mod.state === "healthy"
                            ? "bg-emerald"
                            : mod.state === "evolving"
                              ? "bg-amber"
                              : "bg-rust"
                        }`}
                      />
                      <span className="font-mono text-xs font-medium text-foreground truncate">
                        {mod.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-muted font-mono text-[11px] shrink-0">
                      <span title="Inbound dependents (Fan-In)">↓ {mod.fanIn} in</span>
                      <span title="Outbound dependencies (Fan-Out)">↑ {mod.fanOut} out</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Commits Feed */}
          <div className="rounded-md border border-border bg-surface p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted" />
                <h2 className="text-xs font-semibold text-foreground tracking-wide uppercase">
                  Recent Commit History
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigateToScreen("history")}
                className="flex items-center gap-1 text-[11px] text-accent hover:underline cursor-pointer"
              >
                Full History <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>

            {commits.length === 0 ? (
              <p className="text-xs text-muted py-3 text-center">No commit logs recorded.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {commits.slice(0, 4).map((c) => (
                  <div
                    key={c.hash}
                    className="flex flex-col gap-1 rounded-sm border border-border/70 bg-raised/30 p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-accent font-semibold">
                        {c.hash.slice(0, 7)}
                      </span>
                      <span className="text-[11px] text-muted truncate max-w-[140px]">
                        {c.author}
                      </span>
                    </div>
                    <p className="text-xs text-foreground truncate font-medium">{c.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Metric Card Sub-Component ───────────────────────────────────── */

function MetricCard({
  label,
  value,
  unit,
  detail,
  icon: Icon,
  onClick,
  status,
  badge,
}: {
  label: string;
  value: string;
  unit?: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  status?: "emerald" | "amber" | "rust";
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col justify-between rounded-md border border-border bg-surface p-3.5 text-left transition-all hover:border-accent/50 hover:bg-raised/70 cursor-pointer shadow-2xs"
    >
      <div className="flex items-center justify-between gap-2 w-full mb-2">
        <span className="text-[11px] font-medium text-secondary truncate">{label}</span>
        <div className="flex items-center gap-1">
          {badge && (
            <span className="rounded-xs bg-rust/20 text-rust font-mono text-[9px] px-1 py-0.2 font-bold">
              {badge}
            </span>
          )}
          <Icon className="h-3.5 w-3.5 text-muted group-hover:text-accent transition-colors" />
        </div>
      </div>

      <div>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-xl font-bold tracking-tight text-foreground">
            {value}
          </span>
          {unit && <span className="font-mono text-xs text-muted">{unit}</span>}
          {status && (
            <span
              className={`ml-1.5 h-1.5 w-1.5 rounded-full ${
                status === "rust" ? "bg-rust" : status === "amber" ? "bg-amber" : "bg-emerald"
              }`}
            />
          )}
        </div>
        <p className="mt-1 text-[11px] text-muted truncate">{detail}</p>
      </div>
    </button>
  );
}

/* ── Activity Chart (SVG Smooth Area) ────────────────────────────── */

function ActivityChart({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const w = 400;
  const h = 80;
  const min = 0;
  const max = Math.max(...data, 1);
  const range = max - min;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 10) - 5;
    return `${x},${y}`;
  });

  const pathLine = `M ${pts.join(" L ")}`;
  const pathArea = `M 0,${h} L ${pts.join(" L ")} L ${w},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={pathArea} fill="url(#chartGradient)" />
      <path d={pathLine} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
