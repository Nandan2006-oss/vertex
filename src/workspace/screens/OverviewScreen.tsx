import { useMemo } from "react";
import { useAnalysis } from "../../analysis/AnalysisContext";
import { EmptyState } from "../EmptyState";
import type { ModuleRisk } from "../../analysis/types";

export function OverviewScreen() {
  const analysis = useAnalysis();
  const {
    services, metrics, commits, commitCount, totalLines,
    languages, sourceFiles, framework, classifiedFiles,
    evidence, moduleRisks, fileCount, coverage,
  } = analysis;

  const stats = useMemo(() => {
    const sourceCount = sourceFiles.length;
    const docCount = classifiedFiles.find((c) => c.category === "documentation")?.count ?? 0;
    const testCount = classifiedFiles.find((c) => c.category === "test")?.count ?? 0;
    const configCount = classifiedFiles.find((c) => c.category === "config")?.count ?? 0;
    const totalServices = services.length;
    const avgCommits =
      metrics.deployCadence.length > 0
        ? Math.round(
            metrics.deployCadence.reduce((s, p) => s + p.value, 0) /
              metrics.deployCadence.length,
          )
        : 0;
    const currentDebt =
      metrics.debtTrend.length > 0
        ? metrics.debtTrend[metrics.debtTrend.length - 1].value
        : 0;
    const recentCommits = commits.slice(0, 3);
    const topRisky = moduleRisks.filter((r) => r.riskScore > 30).slice(0, 3);
    const confidenceLabel = coverage.confidence === "high" ? "High" : coverage.confidence === "medium" ? "Medium" : "Low";
    return {
      sourceCount, docCount, testCount, configCount,
      totalServices, avgCommits, currentDebt, recentCommits, topRisky,
      confidenceLabel,
    };
  }, [services, metrics, commits, sourceFiles, classifiedFiles, moduleRisks, coverage]);

  if (services.length === 0 && fileCount === 0) {
    return (
      <EmptyState
        title="No data yet"
        body="We couldn't extract any files from this repository. Try a repository with source files."
      />
    );
  }

  const locDisplay = totalLines !== null
    ? `${(totalLines / 1000).toFixed(1)}k LOC`
    : "LOC: unavailable";
  const locPerFile = totalLines !== null && stats.sourceCount > 0
    ? `~${Math.round(totalLines / Math.max(1, stats.sourceCount))} LOC/file`
    : "—";

  return (
    <div className="flex flex-col gap-8">
      {/* Top row: repo stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Source files"
          value={String(stats.sourceCount)}
          note={locDisplay}
        />
        <StatCard
          label="Modules"
          value={String(stats.totalServices)}
          note={locPerFile}
        />
        <StatCard
          label="Commits"
          value={String(commitCount)}
          note={`${commits.length > 0 ? `latest: ${commits[0].hash}` : "—"}`}
        />
        <StatCard
          label="Debt score"
          value={String(stats.currentDebt)}
          note="current (estimated from evidence)"
          state={stats.currentDebt > 340 ? "rust" : "emerald"}
        />
      </div>

      {/* Coverage indicator */}
      <div className="rounded-sm border border-border bg-surface px-4 py-2">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-secondary">Analysis coverage:</span>
          <span className={`font-medium ${
            coverage.confidence === "high" ? "text-emerald" :
            coverage.confidence === "medium" ? "text-amber" : "text-rust"
          }`}>
            {stats.confidenceLabel}
          </span>
          <span className="text-muted">|</span>
          <span className="text-muted">{coverage.history.label}</span>
          <span className="text-muted">|</span>
          <span className="text-muted">{coverage.files.analyzed} / {coverage.files.total} files</span>
        </div>
      </div>

      {/* Framework + language info */}
      {(framework || languages.length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {framework && (
            <div className="rounded-sm border border-border bg-surface px-4 py-3">
              <span className="text-xs text-secondary">Framework</span>
              <p className="mt-1 text-sm font-medium text-foreground">{framework.name}</p>
              {framework.buildSystem && (
                <p className="text-xs text-muted">Build: {framework.buildSystem}</p>
              )}
            </div>
          )}
          {stats.testCount > 0 && (
            <div className="rounded-sm border border-border bg-surface px-4 py-3">
              <span className="text-xs text-secondary">Files by type</span>
              <div className="mt-1 flex gap-3 text-sm">
                <span className="text-foreground">{stats.sourceCount} source</span>
                <span className="text-muted">{stats.testCount} test</span>
                <span className="text-muted">{stats.configCount} config</span>
                <span className="text-muted">{stats.docCount} docs</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top risky modules */}
      {stats.topRisky.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-secondary">Highest Risk Modules</h3>
          <div className="flex flex-col gap-2">
            {stats.topRisky.map((r) => (
              <RiskyModuleCard key={r.moduleName} risk={r} />
            ))}
          </div>
        </div>
      )}

      {/* Languages bar */}
      {languages.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-secondary">Languages</h3>
          <div className="flex flex-col gap-2">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-border">
              {languages.slice(0, 8).map((lang) => (
                <div
                  key={lang.name}
                  title={`${lang.name} ${lang.percentage}%`}
                  style={{
                    width: `${lang.percentage}%`,
                    backgroundColor: lang.color,
                  }}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {languages.slice(0, 6).map((lang) => (
                <span
                  key={lang.name}
                  className="flex items-center gap-1.5 text-xs text-secondary"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: lang.color }}
                    aria-hidden="true"
                  />
                  {lang.name}
                  <span className="font-mono text-muted">
                    {lang.percentage}%
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sparklines */}
      <div className="grid grid-cols-2 gap-4">
        <SparklineCard
          title="Commit cadence"
          data={metrics.deployCadence.map((p) => p.value)}
          color="var(--color-emerald)"
        />
        <SparklineCard
          title="Debt trend"
          data={metrics.debtTrend.map((p) => p.value)}
          color="var(--color-rust)"
        />
      </div>

      {/* Recent commits (NOT deploys — we don't have deployment evidence) */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-secondary">Recent commits</h3>
        {stats.recentCommits.length === 0 ? (
          <EmptyState
            title="No commit history available"
            body="Commit history is derived from git metadata. GitHub repositories include history automatically."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {stats.recentCommits.map((c) => (
              <div
                key={c.hash}
                className="flex items-center gap-3 rounded-sm border border-border px-3 py-2 text-sm"
              >
                <span className="inline-block h-2 w-2 rounded-full bg-border" />
                <span className="font-mono text-xs text-muted">{c.hash}</span>
                <span className="text-foreground">{c.message}</span>
                <span className="ml-auto whitespace-nowrap text-xs text-muted">
                  {c.author}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Evidence insights */}
      {evidence.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-secondary">Insights</h3>
          <div className="flex flex-col gap-2">
            {evidence.slice(0, 3).map((e, i) => (
              <div
                key={i}
                className="rounded-sm border border-border bg-surface px-4 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{e.insight}</p>
                  <span className="shrink-0 rounded-sm bg-raised px-1.5 py-0.5 text-[10px] text-muted">
                    {e.source}
                  </span>
                </div>
                <ul className="mt-2 flex flex-col gap-0.5">
                  {e.facts.map((fact, fi) => (
                    <li key={fi} className="flex items-start gap-2 text-xs text-secondary">
                      <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-muted" />
                      {fact}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  note,
  state,
}: {
  label: string;
  value: string;
  note: string;
  state?: "rust" | "emerald";
}) {
  const dot = state ? (
    <span
      className={`inline-block h-2 w-2 rounded-full ${state === "rust" ? "bg-rust" : "bg-emerald"}`}
    />
  ) : null;
  return (
    <div className="rounded-sm border border-border bg-surface px-4 py-3">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs text-secondary">{label}</span>
        {dot}
      </div>
      <p className="font-mono text-2xl font-medium tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted">{note}</p>
    </div>
  );
}

function RiskyModuleCard({ risk }: { risk: ModuleRisk }) {
  return (
    <div className="rounded-sm border border-border bg-surface px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-medium text-foreground">{risk.moduleName}</span>
        <div className="flex items-center gap-2">
          <span
            title="Composite heuristic risk score"
            className="inline-flex items-center gap-1 rounded-sm bg-rust/10 px-1.5 py-0.5 text-xs font-medium text-rust"
          >
            {risk.riskScore}/100
          </span>
          {risk.isGodModule && (
            <span className="rounded-sm bg-amber/10 px-1.5 py-0.5 text-xs text-amber">
              Potential God Module
            </span>
          )}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>{risk.loc} LOC</span>
        <span>{risk.fileCount} files</span>
        <span>Complexity estimate: {risk.complexityEstimate}</span>
        <span>{risk.churn} commits</span>
        <span>{risk.dependentCount} dependents</span>
      </div>
      {risk.reasons.length > 0 && (
        <ul className="mt-1 flex flex-col gap-0.5">
          {risk.reasons.slice(0, 2).map((r, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-secondary">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted" />
              {r}
            </li>
          ))}
        </ul>
      )}
      {/* Factor breakdown */}
      {risk.factors && risk.factors.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 border-t border-border pt-2">
          {risk.factors.filter(f => f.contribution > 0).map((f, i) => (
            <span
              key={i}
              title={f.evidence.explanation}
              className="rounded-sm bg-raised px-1.5 py-0.5 text-[10px] text-muted"
            >
              {f.name}: +{f.contribution}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SparklineCard({
  title,
  data,
  color,
}: {
  title: string;
  data: number[];
  color: string;
}) {
  if (data.length < 2) return null;
  const w = 180;
  const h = 40;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const pathD = `M ${pts.join(" L ")}`;
  return (
    <div className="rounded-sm border border-border bg-surface px-4 py-3">
      <h3 className="mb-2 text-xs text-secondary">{title}</h3>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full">
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}