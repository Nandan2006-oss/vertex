import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  LayoutDashboard,
  Share2,
  ArrowLeftRight,
  AlertTriangle,
  History,
  Compass,
  Search,
  PanelLeftClose,
  PanelLeft,
  FolderGit2,
  GitBranch,
  FolderSync,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { ThemeToggle } from "../theme/ThemeToggle";
import { useTheme } from "../theme/useTheme";
import { Brand } from "../components/Brand";
import { CommandPalette } from "../components/CommandPalette";
import { runAnalysis } from "../analysis/run";
import AnalysisContext, { type ScreenId } from "../analysis/AnalysisContext";
import type { RepositoryAnalysis } from "../analysis/types";
import { demoAnalysis } from "../demo-data/analysis";

import { RepositoryOnboarding, type RepositoryInfo } from "./RepositoryOnboarding";
import { AnalysisProgress } from "./AnalysisProgress";
import { OverviewScreen } from "./screens/OverviewScreen";
import { ArchitectureScreen } from "./screens/ArchitectureScreen";
import { DependenciesScreen } from "./screens/DependenciesScreen";
import { TechDebtScreen } from "./screens/TechDebtScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { OnboardingGuideScreen } from "./screens/OnboardingGuideScreen";

type View = "onboarding" | "analyzing" | "dashboard";

interface ScreenEntry {
  id: ScreenId;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType;
  badge?: (a: RepositoryAnalysis) => string | number | null;
}

const SCREENS: ScreenEntry[] = [
  {
    id: "overview",
    label: "Overview",
    shortLabel: "Overview",
    icon: LayoutDashboard,
    component: OverviewScreen,
  },
  {
    id: "architecture",
    label: "Architecture",
    shortLabel: "Arch",
    icon: Share2,
    component: ArchitectureScreen,
    badge: (a) => a.services.length || null,
  },
  {
    id: "dependencies",
    label: "Dependencies",
    shortLabel: "Deps",
    icon: ArrowLeftRight,
    component: DependenciesScreen,
    badge: (a) =>
      a.circularDependencies.length > 0 ? `${a.circularDependencies.length}!` : null,
  },
  {
    id: "tech-debt",
    label: "Tech Debt",
    shortLabel: "Debt",
    icon: AlertTriangle,
    component: TechDebtScreen,
    badge: (a) => a.techDebt.length || null,
  },
  {
    id: "history",
    label: "Git Evolution",
    shortLabel: "History",
    icon: History,
    component: HistoryScreen,
    badge: (a) => a.commitCount > 0 ? a.commitCount : null,
  },
  {
    id: "guide",
    label: "Onboarding Guide",
    shortLabel: "Guide",
    icon: Compass,
    component: OnboardingGuideScreen,
  },
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
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [progress, setProgress] = useState<AnalysisState>({
    fraction: 0,
    stage: "Starting analysis…",
  });
  const [error, setError] = useState<string | null>(null);
  const [repoName, setRepoName] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // Global hotkey for Command Palette (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleNavigate = useCallback((screen: ScreenId | string, filter?: string) => {
    const valid = SCREENS.find((s) => s.id === screen);
    if (valid) {
      setActiveScreen(valid.id);
      if (filter) {
        setSelectedEntity(filter);
      }
    }
  }, []);

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

  const handleLoadDemo = useCallback(() => {
    setRepoName(demoAnalysis.name);
    setAnalysis(demoAnalysis);
    setActiveScreen("overview");
    setView("dashboard");
  }, []);

  // ── Derived state ──
  const currentHash = useMemo(() => {
    if (!analysis) return "—";
    if (analysis.commits.length > 0) return analysis.commits[0].hash.slice(0, 7);
    return analysis.commitCount > 0 ? `${analysis.commitCount}c` : "—";
  }, [analysis]);

  const activeEntry = useMemo(
    () => SCREENS.find((s) => s.id === activeScreen) ?? SCREENS[0],
    [activeScreen],
  );
  const ActiveComponent = activeEntry.component;

  // ── Onboarding state ──
  if (view === "onboarding") {
    return (
      <div className="flex h-screen w-screen flex-col bg-background text-foreground">
        <header className="flex h-13 shrink-0 items-center justify-between border-b border-border px-5 bg-surface/50">
          <div className="flex items-center gap-3">
            <Brand interactive={!!onExit} onActivate={onExit} />
            <span className="rounded-xs border border-border bg-raised/80 px-2 py-0.5 font-mono text-[11px] text-muted">
              v2.0
            </span>
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </header>
        <main className="flex flex-1 items-center justify-center overflow-auto p-6 grid-backdrop">
          <RepositoryOnboarding
            onAnalyze={(repo, files) => handleAnalyze(repo, files)}
            onLoadDemo={handleLoadDemo}
          />
        </main>
      </div>
    );
  }

  // ── Analyzing state ──
  if (view === "analyzing") {
    return (
      <div className="flex h-screen w-screen flex-col bg-background text-foreground">
        <header className="flex h-13 shrink-0 items-center justify-between border-b border-border px-5 bg-surface/50">
          <Brand interactive={!!onExit} onActivate={onExit} />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </header>
        <main className="flex flex-1 items-center justify-center p-6 grid-backdrop">
          {error ? (
            <div className="flex max-w-md flex-col items-center gap-4 rounded-md border border-rust/40 bg-surface p-6 text-center shadow-lg">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rust/10 text-rust">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Analysis Encountered an Error</h3>
                <p className="mt-1 text-xs text-secondary">{error}</p>
              </div>
              <button
                type="button"
                onClick={handleReAnalyze}
                className="cursor-pointer rounded-xs border border-border bg-raised px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-raised/80 active:scale-95"
              >
                Choose another repository
              </button>
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
  const analysisValue = analysis!;

  return (
    <AnalysisContext.Provider
      value={{
        analysis: analysisValue,
        activeScreen,
        navigateToScreen: handleNavigate,
        selectedEntity,
        setSelectedEntity,
      }}
    >
      <div className="flex h-screen w-screen flex-col bg-background text-foreground overflow-hidden font-sans">
        {/* Compact Top Navigation Bar */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3.5 bg-surface/60 backdrop-blur-xs z-20">
          {/* Left: Brand & Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <Brand interactive={!!onExit} onActivate={onExit} />
            <div className="h-4 w-[1px] bg-border hidden sm:block" />
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted min-w-0">
              <span className="flex items-center gap-1 font-mono text-[12px] font-medium text-foreground truncate">
                <FolderGit2 className="h-3.5 w-3.5 text-muted shrink-0" />
                {analysisValue.name}
              </span>
              <ChevronRight className="h-3 w-3 text-muted/60 shrink-0" />
              <span className="text-secondary font-medium truncate">{activeEntry.label}</span>
            </div>
          </div>

          {/* Center: Command Palette Trigger */}
          <div className="flex-1 max-w-md mx-4 hidden md:block">
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="flex w-full cursor-pointer items-center justify-between rounded-sm border border-border bg-raised/40 px-3 py-1.5 text-xs text-muted hover:border-accent/40 hover:text-secondary hover:bg-raised/80 transition-all shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5" />
                <span>Search modules, files, dependencies…</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="rounded-xs border border-border bg-surface px-1.5 py-0.2 text-[10px] font-mono text-muted">
                  ⌘K
                </kbd>
              </div>
            </button>
          </div>

          {/* Right: Branch Info & Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden lg:flex items-center gap-2 rounded-xs border border-border bg-raised/50 px-2 py-1 font-mono text-[11px] text-muted">
              <span className="flex items-center gap-1 text-secondary">
                <GitBranch className="h-3 w-3" />
                {analysisValue.branch || "main"}
              </span>
              <span className="text-muted/60">·</span>
              <span>{currentHash}</span>
            </div>

            <button
              type="button"
              onClick={handleReAnalyze}
              title="Select or re-analyze another repository"
              className="flex cursor-pointer items-center gap-1.5 rounded-xs border border-border bg-surface px-2.5 py-1 text-xs text-secondary transition-colors hover:border-foreground/30 hover:text-foreground active:scale-95"
            >
              <FolderSync className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Change Repo</span>
            </button>

            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </header>

        {/* Workspace Shell: Left Sidebar + Central Screen */}
        <div className="flex flex-1 overflow-hidden">
          {/* Refined Sidebar */}
          <aside
            aria-label="Workspace navigation"
            className={`flex shrink-0 flex-col border-r border-border bg-surface/40 transition-all duration-200 z-10 ${
              isSidebarCollapsed ? "w-14" : "w-56"
            }`}
          >
            {/* Repo Info Header in Sidebar */}
            <div className="border-b border-border/80 p-3">
              <div
                className={`flex items-center justify-between gap-2 ${
                  isSidebarCollapsed ? "justify-center" : ""
                }`}
              >
                {!isSidebarCollapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-xs font-semibold text-foreground">
                      {analysisValue.name}
                    </span>
                    <span className="text-[10px] font-mono text-muted capitalize truncate">
                      {analysisValue.source} source · {analysisValue.framework?.name || "Generic"}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                  title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  className="cursor-pointer rounded-xs p-1 text-muted hover:bg-raised hover:text-foreground transition-colors"
                >
                  {isSidebarCollapsed ? (
                    <PanelLeft className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex flex-1 flex-col gap-0.5 p-2 overflow-y-auto">
              <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted/80">
                {!isSidebarCollapsed && "Intelligence Views"}
              </div>
              {SCREENS.map((s) => {
                const isActive = s.id === activeScreen;
                const Icon = s.icon;
                const badgeVal = s.badge ? s.badge(analysisValue) : null;

                return (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => {
                      setActiveScreen(s.id);
                    }}
                    title={isSidebarCollapsed ? s.label : undefined}
                    className={`group flex w-full cursor-pointer items-center justify-between rounded-sm px-2.5 py-2 text-xs transition-all ${
                      isActive
                        ? "bg-accent/15 text-accent font-semibold shadow-2xs border border-accent/20"
                        : "text-secondary hover:bg-raised/70 hover:text-foreground border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive ? "text-accent" : "text-muted group-hover:text-foreground"
                        }`}
                        aria-hidden="true"
                      />
                      {!isSidebarCollapsed && (
                        <span className="truncate">{s.label}</span>
                      )}
                    </div>
                    {!isSidebarCollapsed && badgeVal !== null && (
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.2 rounded-xs shrink-0 ${
                          String(badgeVal).includes("!")
                            ? "bg-rust/20 text-rust font-bold"
                            : isActive
                              ? "bg-accent/20 text-accent font-medium"
                              : "bg-raised text-muted"
                        }`}
                      >
                        {badgeVal}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Bottom Status & Telemetry Widget */}
            <div className="border-t border-border/80 p-2.5 bg-surface/50">
              {!isSidebarCollapsed ? (
                <div className="flex flex-col gap-1 text-[11px]">
                  <div className="flex items-center justify-between text-muted">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald" />
                      <span>Evidence Coverage</span>
                    </span>
                    <span className="font-mono text-[10px] capitalize text-emerald font-medium">
                      {analysisValue.coverage.confidence}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted/80">
                    <span>{analysisValue.sourceFiles.length} files</span>
                    <span>
                      {analysisValue.totalLines !== null
                        ? `${(analysisValue.totalLines / 1000).toFixed(1)}k LOC`
                        : "analyzed"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center" title="Analysis confidence: High">
                  <CheckCircle2 className="h-4 w-4 text-emerald" />
                </div>
              )}
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex flex-1 flex-col overflow-auto bg-background p-4 sm:p-6">
            <div key={activeScreen} className="animate-fade-in flex flex-1 flex-col min-w-0">
              <ActiveComponent />
            </div>
          </main>
        </div>

        {/* Global Command Palette */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          analysis={analysisValue}
          onNavigate={(screenId) => handleNavigate(screenId)}
          onSelectModule={(moduleName) => {
            handleNavigate("architecture", moduleName);
          }}
          onSelectFile={(filePath) => {
            handleNavigate("architecture", filePath);
          }}
          onReAnalyze={handleReAnalyze}
          onToggleTheme={toggleTheme}
          theme={theme}
        />
      </div>
    </AnalysisContext.Provider>
  );
}
