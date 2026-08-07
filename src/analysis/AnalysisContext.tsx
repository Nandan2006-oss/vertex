import { createContext, useContext } from "react";
import type { RepositoryAnalysis } from "./types";

export interface AnalysisContextValue {
  analysis: RepositoryAnalysis;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function useAnalysis(): RepositoryAnalysis {
  const ctx = useContext(AnalysisContext);
  if (!ctx) {
    throw new Error("useAnalysis must be used within an AnalysisProvider");
  }
  return ctx.analysis;
}

export default AnalysisContext;