import { createContext, useContext } from "react";
import type { RepositoryAnalysis } from "./types";

export type ScreenId =
  | "overview"
  | "architecture"
  | "dependencies"
  | "tech-debt"
  | "history"
  | "guide";

export interface AnalysisContextValue {
  analysis: RepositoryAnalysis;
  activeScreen?: ScreenId;
  navigateToScreen?: (screen: ScreenId, filter?: string) => void;
  selectedEntity?: string | null;
  setSelectedEntity?: (entity: string | null) => void;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function useAnalysis(): RepositoryAnalysis {
  const ctx = useContext(AnalysisContext);
  if (!ctx) {
    throw new Error("useAnalysis must be used within an AnalysisProvider");
  }
  return ctx.analysis;
}

export function useWorkspaceNav() {
  const ctx = useContext(AnalysisContext);
  return {
    activeScreen: ctx?.activeScreen ?? "overview",
    navigateToScreen: ctx?.navigateToScreen ?? (() => {}),
    selectedEntity: ctx?.selectedEntity ?? null,
    setSelectedEntity: ctx?.setSelectedEntity ?? (() => {}),
  };
}

export default AnalysisContext;
