import { useState } from "react";
import {
  Compass,
  ArrowRight,
  FileCode,
  Layers,
  AlertTriangle,
  Users,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import { useAnalysis, useWorkspaceNav } from "../../analysis/AnalysisContext";
import { EmptyState } from "../EmptyState";

export function OnboardingGuideScreen() {
  const analysis = useAnalysis();
  const { navigateToScreen } = useWorkspaceNav();
  const guide = analysis.onboardingGuide;

  const [activeStep, setActiveStep] = useState<number>(1);

  if (!guide) {
    return (
      <EmptyState
        title="Onboarding Guide unavailable"
        body="The guided codebase exploration is generated from repository entry points and dependency flow. Repositories without recognized entry points may not generate a guide."
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 min-w-0">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-md border border-border bg-surface p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-accent-muted text-accent border border-accent/20">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-base font-semibold text-foreground tracking-tight">
              Developer Onboarding Roadmap
            </h1>
            <p className="text-xs text-muted">
              Evidence-based codebase mental model for new engineers joining{" "}
              <span className="font-mono text-foreground font-semibold">{analysis.name}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-xs border border-border bg-raised px-2 py-1 font-mono text-[11px] text-secondary">
            {guide.projectType}
          </span>
          <span className="rounded-xs border border-border bg-raised px-2 py-1 font-mono text-[11px] text-muted">
            {guide.recommendedPath.length} Milestones
          </span>
        </div>
      </div>

      {/* 4 Telemetry Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-md border border-border bg-surface p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-secondary">Identified Entry Points</span>
          <p className="font-mono text-2xl font-bold text-foreground mt-1">
            {guide.entryPoints.length}
          </p>
          <span className="text-[10px] text-muted font-mono">App bootstrap files</span>
        </div>

        <div className="rounded-md border border-border bg-surface p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-secondary">Core Architecture Pillars</span>
          <p className="font-mono text-2xl font-bold text-foreground mt-1">
            {guide.majorModules.length}
          </p>
          <span className="text-[10px] text-muted font-mono">Primary domain modules</span>
        </div>

        <div className="rounded-md border border-border bg-surface p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-secondary">Exploration Steps</span>
          <p className="font-mono text-2xl font-bold text-accent mt-1">
            {guide.recommendedPath.length}
          </p>
          <span className="text-[10px] text-muted font-mono">Sequential reading order</span>
        </div>

        <div className="rounded-md border border-border bg-surface p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-secondary">High-Caution Modules</span>
          <p
            className={`font-mono text-2xl font-bold mt-1 ${
              guide.riskyModules.length > 0 ? "text-rust" : "text-emerald"
            }`}
          >
            {guide.riskyModules.length}
          </p>
          <span className="text-[10px] text-muted font-mono">Require extra test coverage</span>
        </div>
      </div>

      {/* Recommended Exploration Sequence (Roadmap) */}
      <div className="rounded-md border border-border bg-surface p-5 shadow-2xs flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-accent" />
            <h2 className="text-xs font-semibold text-foreground tracking-wide uppercase">
              1. Recommended Sequential Exploration Path
            </h2>
          </div>
          <span className="text-[11px] text-muted font-mono">
            Low-risk foundations first, complex areas last
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          {guide.recommendedPath.map((step) => {
            const isCurrent = activeStep === step.step;
            return (
              <div
                key={step.file}
                onClick={() => setActiveStep(step.step)}
                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-sm border p-3.5 transition-all cursor-pointer ${
                  isCurrent
                    ? "border-accent bg-accent/10 shadow-2xs"
                    : "border-border/80 bg-raised/30 hover:border-accent/30 hover:bg-raised/60"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xs font-mono text-xs font-bold ${
                      isCurrent
                        ? "bg-accent text-white shadow-2xs"
                        : "bg-surface border border-border text-muted"
                    }`}
                  >
                    {step.step}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-mono text-xs font-bold text-foreground truncate">
                      {step.file}
                    </span>
                    <p className="text-xs text-secondary mt-0.5 leading-relaxed">
                      {step.reason}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateToScreen("architecture", step.file);
                    }}
                    className="flex cursor-pointer items-center gap-1 rounded-xs border border-border bg-surface px-2.5 py-1 text-[11px] font-mono text-secondary hover:border-accent/40 hover:text-foreground transition-colors"
                  >
                    Inspect in Graph <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Entry Points & High Caution Areas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Entry Points */}
        <div className="rounded-md border border-border bg-surface p-4 shadow-2xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="h-4 w-4 text-emerald" />
              <h2 className="text-xs font-semibold text-foreground tracking-wide uppercase">
                2. Application Entry Points
              </h2>
            </div>
            <span className="text-[11px] font-mono text-muted">
              {guide.entryPoints.length} files
            </span>
          </div>
          <p className="text-[11px] text-muted">
            Execution starts here. Trace outbound imports from these files to understand initialization.
          </p>

          <div className="flex flex-col gap-2">
            {guide.entryPoints.map((ep) => (
              <div
                key={ep}
                onClick={() => navigateToScreen("architecture", ep)}
                className="flex items-center justify-between rounded-xs border border-border/80 bg-raised/30 p-2.5 text-xs transition-colors hover:border-accent/40 hover:bg-raised cursor-pointer"
              >
                <div className="flex items-center gap-2 font-mono text-foreground font-medium truncate">
                  <FileCode className="h-3.5 w-3.5 text-accent shrink-0" />
                  <span className="truncate">{ep}</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* High-Caution Modules */}
        <div className="rounded-md border border-border bg-surface p-4 shadow-2xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rust" />
              <h2 className="text-xs font-semibold text-foreground tracking-wide uppercase">
                3. Approach With Care
              </h2>
            </div>
            <span className="text-[11px] font-mono text-muted">
              {guide.riskyModules.length} modules
            </span>
          </div>
          <p className="text-[11px] text-muted">
            These modules carry heavy churn or high coupling. Advise pairing or writing end-to-end tests before modifying.
          </p>

          <div className="flex flex-col gap-2">
            {guide.riskyModules.length === 0 ? (
              <p className="text-xs text-muted py-4 text-center">
                No high-caution modules detected. System architecture is cleanly balanced.
              </p>
            ) : (
              guide.riskyModules.map((m) => (
                <div
                  key={m}
                  onClick={() => navigateToScreen("tech-debt", m)}
                  className="flex items-center justify-between rounded-xs border border-rust/30 bg-rust/10 p-2.5 text-xs transition-colors hover:border-rust/50 cursor-pointer"
                >
                  <span className="font-mono text-rust font-semibold truncate">{m}</span>
                  <span className="flex items-center gap-1 font-mono text-[11px] text-rust">
                    Inspect in Tech Debt <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Codebase Ownership Directory: "Who Knows What" */}
      {guide.primaryContributors.length > 0 && (
        <div className="rounded-md border border-border bg-surface p-5 shadow-2xs flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              <h2 className="text-xs font-semibold text-foreground tracking-wide uppercase">
                4. Codebase Ownership & PR Review Directory
              </h2>
            </div>
            <span className="text-[11px] text-muted font-mono">
              Identified from historical commit authorship
            </span>
          </div>

          <p className="text-xs text-secondary">
            When you need PR reviews, architecture clarification, or domain questions answered, these teammates have historical commit ownership in each area:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {guide.primaryContributors.map((c) => (
              <div
                key={c.module}
                className="flex flex-col gap-1.5 rounded-sm border border-border/80 bg-raised/30 p-3 text-xs"
              >
                <div className="flex items-center gap-2 font-mono font-bold text-foreground">
                  <Layers className="h-3.5 w-3.5 text-accent" />
                  <span className="truncate">{c.module}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className="text-[11px] text-muted">Lead engineers:</span>
                  {c.people.map((p) => (
                    <span
                      key={p}
                      className="rounded-xs bg-surface border border-border px-1.5 py-0.5 font-mono text-[10px] text-foreground font-medium"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
