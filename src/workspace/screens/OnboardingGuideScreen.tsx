import { useAnalysis } from "../../analysis/AnalysisContext";
import { EmptyState } from "../EmptyState";

export function OnboardingGuideScreen() {
  const analysis = useAnalysis();
  const guide = analysis.onboardingGuide;

  if (!guide) {
    return (
      <EmptyState
        title="Guide not available"
        body="The onboarding guide is generated from repository analysis. Try a GitHub repository with source files."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
          New Developer Guide
        </h1>
        <p className="mt-1 text-sm text-secondary">
          A recommended exploration path for{" "}
          <span className="font-mono">{analysis.name}</span>
        </p>
      </div>

      {/* Project info */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <InfoCard label="Project type" value={guide.projectType} />
        <InfoCard
          label="Entry points"
          value={guide.entryPoints.length > 0 ? String(guide.entryPoints.length) : "Not detected"}
        />
        <InfoCard
          label="Major modules"
          value={String(guide.majorModules.length)}
        />
        <InfoCard
          label="Risky modules"
          value={String(guide.riskyModules.length)}
          state={guide.riskyModules.length > 0 ? "warn" : "ok"}
        />
      </div>

      {/* Entry points */}
      {guide.entryPoints.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-secondary">
            1. Entry Points
          </h2>
          <p className="mb-3 text-xs text-muted">
            These files are where the application starts. Begin your exploration here.
          </p>
          <div className="flex flex-col gap-1">
            {guide.entryPoints.map((ep, i) => (
              <div
                key={ep}
                className="flex items-center gap-3 rounded-sm border border-border bg-surface px-3 py-2.5"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-raised font-mono text-xs text-muted">
                  {i + 1}
                </span>
                <span className="font-mono text-sm text-foreground">{ep}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recommended exploration path */}
      {guide.recommendedPath.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-secondary">
            2. Recommended Exploration Path
          </h2>
          <p className="mb-3 text-xs text-muted">
            These modules are ordered by relevance and risk — start with low-risk foundational
            modules before tackling complex areas.
          </p>
          <div className="flex flex-col gap-2">
            {guide.recommendedPath.map((r) => (
              <div
                key={r.file}
                className="flex items-start gap-3 rounded-sm border border-border bg-surface px-3 py-3"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-foreground/10 font-mono text-xs font-medium text-foreground">
                  {r.step}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-sm text-foreground">{r.file}</span>
                  <span className="text-xs text-secondary">{r.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Major modules */}
      {guide.majorModules.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-secondary">
            3. Major Modules
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {guide.majorModules.map((m) => (
              <div
                key={m.name}
                className="rounded-sm border border-border bg-surface px-3 py-2.5"
              >
                <span className="font-mono text-sm font-medium text-foreground">
                  {m.name}
                </span>
                <p className="text-xs text-secondary">{m.description}</p>
                <span className="font-mono text-[11px] text-muted">
                  {m.fileCount} file{m.fileCount === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Risky modules */}
      {guide.riskyModules.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-secondary">
            4. Modules to Approach Carefully
          </h2>
          <p className="mb-3 text-xs text-muted">
            These modules have elevated risk scores. Understand them before making changes.
          </p>
          <div className="flex flex-wrap gap-2">
            {guide.riskyModules.map((m) => (
              <span
                key={m}
                className="inline-flex items-center gap-1.5 rounded-sm border border-rust/30 bg-rust/8 px-2.5 py-1.5 font-mono text-xs text-rust"
              >
                {m}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Primary contributors */}
      {guide.primaryContributors.some((pc) => pc.people.length > 0) && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-secondary">
            5. Who Knows What
          </h2>
          <p className="mb-3 text-xs text-muted">
            Contributors with the highest historical activity in each module.
          </p>
          <div className="flex flex-col gap-1">
            {guide.primaryContributors
              .filter((pc) => pc.people.length > 0)
              .slice(0, 8)
              .map((pc) => (
                <div
                  key={pc.module}
                  className="flex items-center gap-3 rounded-sm border border-border bg-surface px-3 py-2.5 text-sm"
                >
                  <span className="font-mono text-xs text-foreground">{pc.module}</span>
                  <span className="text-muted">→</span>
                  <span className="text-xs text-secondary">
                    {pc.people.join(", ")}
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      <p className="text-xs text-muted">
        Source: Static Analysis + Git History. Recommendations are evidence-based, not AI-generated.
      </p>
    </div>
  );
}

function InfoCard({
  label,
  value,
  state,
}: {
  label: string;
  value: string;
  state?: "warn" | "ok";
}) {
  const dot = state ? (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        state === "warn" ? "bg-amber" : "bg-emerald"
      }`}
    />
  ) : null;
  return (
    <div className="rounded-sm border border-border bg-surface px-3 py-2.5">
      <p className="text-xs text-secondary">{label}</p>
      <p className="mt-0.5 flex items-center gap-2 font-mono text-sm font-medium text-foreground">
        {value}
        {dot}
      </p>
    </div>
  );
}