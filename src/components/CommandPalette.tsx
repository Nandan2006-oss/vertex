import { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  LayoutDashboard,
  Share2,
  ArrowLeftRight,
  AlertTriangle,
  History,
  Compass,
  FileCode,
  Package,
  Layers,
  ArrowRight,
  Sun,
  Moon,
  FolderSync,
  X,
} from "lucide-react";
import type { RepositoryAnalysis } from "../analysis/types";

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "Navigation" | "Modules" | "Files" | "Packages" | "Actions";
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
  badge?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: RepositoryAnalysis;
  onNavigate: (screenId: string) => void;
  onSelectModule?: (moduleName: string) => void;
  onSelectFile?: (filePath: string) => void;
  onReAnalyze: () => void;
  onToggleTheme?: () => void;
  theme?: "dark" | "light";
}

export function CommandPalette({
  isOpen,
  onClose,
  analysis,
  onNavigate,
  onSelectModule,
  onSelectFile,
  onReAnalyze,
  onToggleTheme,
  theme,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global keydown listeners for palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Build searchable items
  const items = useMemo(() => {
    const list: CommandItem[] = [
      {
        id: "nav-overview",
        title: "Overview",
        subtitle: "Executive health dashboard & codebase telemetry",
        category: "Navigation",
        icon: LayoutDashboard,
        onSelect: () => {
          onNavigate("overview");
          onClose();
        },
      },
      {
        id: "nav-architecture",
        title: "Architecture Map",
        subtitle: "Interactive force graph & module connectivity",
        category: "Navigation",
        icon: Share2,
        onSelect: () => {
          onNavigate("architecture");
          onClose();
        },
      },
      {
        id: "nav-dependencies",
        title: "Dependencies Workspace",
        subtitle: "Internal imports, external libraries & circular cycles",
        category: "Navigation",
        icon: ArrowLeftRight,
        onSelect: () => {
          onNavigate("dependencies");
          onClose();
        },
      },
      {
        id: "nav-tech-debt",
        title: "Technical Debt & Risk",
        subtitle: "Evidence-based risk factors, complexity & churn",
        category: "Navigation",
        icon: AlertTriangle,
        onSelect: () => {
          onNavigate("tech-debt");
          onClose();
        },
      },
      {
        id: "nav-history",
        title: "Git Evolution & Co-Changes",
        subtitle: "Commit trends, contributor knowledge & churn patterns",
        category: "Navigation",
        icon: History,
        onSelect: () => {
          onNavigate("history");
          onClose();
        },
      },
      {
        id: "nav-guide",
        title: "Onboarding Roadmap",
        subtitle: "Guided codebase entry points & domain sequence",
        category: "Navigation",
        icon: Compass,
        onSelect: () => {
          onNavigate("guide");
          onClose();
        },
      },
      {
        id: "action-reanalyze",
        title: "Switch or Re-analyze Repository",
        subtitle: "Choose another directory or GitHub repo",
        category: "Actions",
        icon: FolderSync,
        onSelect: () => {
          onReAnalyze();
          onClose();
        },
      },
      {
        id: "action-theme",
        title: `Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`,
        subtitle: "Toggle application theme contrast",
        category: "Actions",
        icon: theme === "dark" ? Sun : Moon,
        onSelect: () => {
          onToggleTheme?.();
          onClose();
        },
      },
    ];

    // Modules
    analysis.services.forEach((s) => {
      list.push({
        id: `module-${s.id}`,
        title: s.name,
        subtitle: `${s.files.length} files · ${s.loc.toLocaleString()} LOC · ${s.state}`,
        category: "Modules",
        icon: Layers,
        badge: s.state,
        onSelect: () => {
          onNavigate("architecture");
          onSelectModule?.(s.name);
          onClose();
        },
      });
    });

    // Top Source files (first 60)
    analysis.sourceFiles.slice(0, 60).forEach((f) => {
      list.push({
        id: `file-${f.path}`,
        title: f.path,
        subtitle: `${f.language ?? "Source"} · ${f.loc ? `${f.loc} LOC` : "analyzed"}`,
        category: "Files",
        icon: FileCode,
        badge: f.category,
        onSelect: () => {
          onNavigate("architecture");
          onSelectFile?.(f.path);
          onClose();
        },
      });
    });

    // External Packages
    analysis.externalDependencies.forEach((pkg) => {
      list.push({
        id: `pkg-${pkg.name}`,
        title: pkg.name,
        subtitle: `Imported by ${pkg.imports.length} file(s)`,
        category: "Packages",
        icon: Package,
        onSelect: () => {
          onNavigate("dependencies");
          onClose();
        },
      });
    });

    return list;
  }, [analysis, onNavigate, onSelectModule, onSelectFile, onReAnalyze, onToggleTheme, theme, onClose]);

  // Filter items by query
  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 25);
    const q = query.toLowerCase();
    return items
      .filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.subtitle?.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [items, query]);

  // Adjust selection bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation within list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].onSelect();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-background/80 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-md border border-border bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 bg-raised/40">
          <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, search modules, files, or packages…"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-hidden"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-xs p-1 text-muted hover:text-foreground hover:bg-raised transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results List */}
        <div ref={listRef} className="overflow-y-auto p-2 flex flex-col gap-0.5 max-h-[380px]">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onSelect}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-accent-muted text-foreground font-medium"
                      : "text-secondary hover:bg-raised/60 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-xs ${
                        isSelected ? "bg-accent text-white" : "bg-raised text-muted"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-foreground font-medium">{item.title}</span>
                      {item.subtitle && (
                        <span className="truncate text-[11px] text-muted">{item.subtitle}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {item.badge && (
                      <span className="rounded-xs bg-raised px-1.5 py-0.5 text-[10px] text-muted font-mono">
                        {item.badge}
                      </span>
                    )}
                    <span className="text-[10px] text-muted/70 uppercase tracking-wider font-mono">
                      {item.category}
                    </span>
                    <ArrowRight
                      className={`h-3 w-3 ${isSelected ? "text-accent opacity-100" : "opacity-0"}`}
                    />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted bg-surface">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded-xs bg-raised px-1 py-0.5 text-[10px] font-mono border border-border">↑</kbd>{" "}
              <kbd className="rounded-xs bg-raised px-1 py-0.5 text-[10px] font-mono border border-border">↓</kbd> Navigate
            </span>
            <span>
              <kbd className="rounded-xs bg-raised px-1 py-0.5 text-[10px] font-mono border border-border">↵</kbd> Select
            </span>
            <span>
              <kbd className="rounded-xs bg-raised px-1 py-0.5 text-[10px] font-mono border border-border">esc</kbd> Dismiss
            </span>
          </div>
          <span className="font-mono text-[10px] text-muted">Vertex Intelligence</span>
        </div>
      </div>
    </div>
  );
}

