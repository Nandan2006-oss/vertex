import { useState, useMemo, useRef, useCallback } from "react";
import {
  Activity,
  Share2,
  ArrowLeftRight,
  AlertTriangle,
  History,
  Compass,
} from "lucide-react";
import { ThemeToggle } from "../theme/ThemeToggle";
import { useTheme } from "../theme/useTheme";
import { Brand } from "../components/Brand";
import { runAnalysis } from "../analysis/run";
import AnalysisContext from "../analysis/AnalysisContext";
import type { RepositoryAnalysis } from "../analysis/types";

import { RepositoryOnboarding, type RepositoryInfo } from "./RepositoryOnboarding";
import { AnalysisProgress } from "./AnalysisProgress";
import { OverviewScreen } from "./screens/OverviewScreen";
import { ArchitectureScreen } from "./screens/ArchitectureScreen";
import { DependenciesScreen } from "./screens/DependenciesScreen";
import { TechDebtScreen } from "./screens/TechDebtScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { OnboardingGuideScreen } from "./screens/OnboardingGuideScreen";

type View = "onboarding" | "analyzing" | "dashboard";

type ScreenId =
  | "overview"
  | "architecture"
  | "dependencies"
  | "tech-debt"
  | "history"
  | "guide";

interface ScreenEntry {
  id: ScreenId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType;
}

const SCREENS: ScreenEntry[] = [
  { id: "overview", label: "Overview", icon: Activity, component: OverviewScreen },
  { id: "architecture", label: "Architecture", icon: Share2, component: ArchitectureScreen },
  { id: "dependencies", label: "Dependencies", icon: ArrowLeftRight, component: DependenciesScreen },
  { id: "tech-debt", label: "Tech Debt", icon: AlertTriangle, component: TechDebtScreen },
  { id: "history", label: "History", icon: History, component: HistoryScreen },
  { id: "guide", label: "Guide", icon: Compass, component: OnboardingGuideScreen },
];

interface AnalysisState {
  fraction: number;
  stage: string;
  detail?: string;
}

interface WorkspaceShellProps {
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
  onExit?: () => void;
}

export function WorkspaceShell({ theme: themeProp, onToggleTheme, onExit }: WorkspaceShellProps) {
  const { theme: internalTheme, toggleTheme: internalToggle } = useTheme();
  const theme = themeProp ?? internalTheme;
  const toggleTheme = onToggleTheme ?? internalToggle;

  const [view, setView] = useState<View>("onboarding");
  const [analysis, setAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [activeScreen, setActiveScreen] = useState<ScreenId>("overview");
  const [progress, setProgress] = useState<AnalysisState>({
    fraction: 0,
    stage: "Starting analysis…",
  });
  const [error, setError] = useState<string | null>(null);
  const [repoName, setRepoName] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const handleAnalyze = useCallback(
    async (repo: RepositoryInfo, files?: File[]) => {
      setError(null);
      setRepoName(repo.name);
      setView("analyzing");
      setProgress({ fraction: 0.05, stage: "Starting analysis…" });

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const result = await runAnalysis({
          repo,
          files,
          signal: ctrl.signal,
          onProgress: (p) => {
            setProgress({
              fraction: p.fraction,
              stage: p.stage,
              detail: p.detail,
            });
          },
        });
        if (!ctrl.signal.aborted) {
          setAnalysis(result.analysis);
          setActiveScreen("overview");
          setView("dashboard");
        }
      } catch (err: unknown) {
        if (ctrl.signal.aborted) return;
        const msg =
          err instanceof Error ? err.message : "Analysis failed unexpectedly.";
        // If the user hasn't navigated away, show error with retry.
        if (view === "analyzing") {
          setError(msg);
        }
      }
    },
    [view],
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setView("onboarding");
  }, []);

  const handleReAnalyze = useCallback(() => {
    setView("onboarding");
    setAnalysis(null);
  }, []);

  // ── Derived state ──
  const currentHash = useMemo(() => {
    if (!analysis) return "—";
    if (analysis.commits.length > 0) return analysis.commits[0].hash.slice(0, 7);
    return analysis.commitCount > 0 ? `${analysis.commitCount}c` : "—";
  }, [analysis]);

  const ActiveComponent = useMemo(
    () => SCREENS.find((s) => s.id === activeScreen)?.component ?? OverviewScreen,
    [activeScreen],
  );

  // ── Onboarding state ──
  if (view === "onboarding") {
    return (
      <div className="flex h-screen w-screen flex-col bg-background text-foreground">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-4">
            <Brand interactive={!!onExit} onActivate={onExit} />
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </header>
        <main className="flex flex-1 items-center justify-center overflow-auto p-6">
          <RepositoryOnboarding
            onAnalyze={(repo, files) => handleAnalyze(repo, files)}
          />
        </main>
      </div>
    );
  }

  // ── Analyzing state ──
  if (view === "analyzing") {
    return (
      <div className="flex h-screen w-screen flex-col bg-background text-foreground">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <Brand interactive={!!onExit} onActivate={onExit} />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </header>
        <main className="flex flex-1 items-center justify-center">
          {error ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-sm text-rust">{error}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleReAnalyze}
                  className="cursor-pointer rounded-sm border border-border bg-surface px-4 py-2 text-sm text-foreground transition-colors hover:bg-raised active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                >
                  Choose another repository
                </button>
              </div>
            </div>
          ) : (
            <AnalysisProgress
              repoName={repoName}
              stage={progress.stage}
              detail={progress.detail}
              fraction={progress.fraction}
              onCancel={handleCancel}
            />
          )}
        </main>
      </div>
    );
  }

  // ── Dashboard state ──
  // Guaranteed analysis is non-null here.
  const analysisValue = analysis!;

  return (
    <AnalysisContext.Provider value={{ analysis: analysisValue }}>
      <div className="flex h-screen w-screen flex-col bg-background text-foreground">
        {/* Top bar */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-4">
            <Brand interactive={!!onExit} onActivate={onExit} />
            <span className="hidden rounded-sm border border-border bg-surface px-2 py-0.5 font-mono text-[13px] text-secondary sm:inline-block">
              {analysisValue.name}
            </span>
            <span className="font-mono text-xs text-muted">{currentHash}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReAnalyze}
              className="cursor-pointer rounded-sm border border-border px-2 py-1 text-xs text-muted transition-colors hover:border-foreground/30 hover:text-secondary active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              Analyze another repo
            </button>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </header>

        {/* Body: left rail + content */}
        <div className="flex flex-1 overflow-hidden">
          <nav
            aria-label="Workspace screens"
            className="flex w-52 shrink-0 flex-col gap-0.5 border-r border-border py-3"
          >
            {SCREENS.map((s) => {
              const isActive = s.id === activeScreen;
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setActiveScreen(s.id)}
                  className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "bg-raised font-medium text-foreground"
                      : "text-muted hover:bg-surface hover:text-secondary"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {s.label}
                </button>
              );
            })}
          </nav>

          {/* Content area */}
          <main className="flex flex-1 flex-col overflow-auto p-6">
            <div key={activeScreen} className="animate-fade-in flex flex-1 flex-col">
              <ActiveComponent />
            </div>
          </main>
        </div>
      </div>
    </AnalysisContext.Provider>
  );
}