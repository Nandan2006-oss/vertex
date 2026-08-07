/**
 * Orchestrates a repository analysis (local or GitHub) with progress
 * reporting, returning the finished RepositoryAnalysis.
 */
import type {
  AnalysisProgressFn,
  AnalysisResult,
  RepositoryAnalysis,
} from "./types";
import type { RepositoryInfo } from "../workspace/RepositoryOnboarding";
import { analyzeGithubRepository } from "./github";
import { analyzeLocalRepository } from "./local";

export interface RunAnalysisInput {
  repo: RepositoryInfo;
  /** Uploaded files (local source only) */
  files?: File[];
  onProgress?: AnalysisProgressFn;
  signal?: AbortSignal;
}

export async function runAnalysis(input: RunAnalysisInput): Promise<AnalysisResult> {
  const { repo, files, onProgress, signal } = input;
  const report: AnalysisProgressFn = onProgress ?? (() => {});

  if (repo.source === "github") {
    const analysis = await analyzeGithubRepository(
      repo.raw ?? repo.name,
      repo.name,
      report,
      signal,
    );
    return { analysis };
  }

  if (!files || files.length === 0) {
    throw new Error("No files selected for local analysis");
  }

  const analysis = await analyzeLocalRepository(files, repo.name, report);
  return { analysis };
}

/** Small helper so screens can read derived totals consistently. */
export function analysisStats(analysis: RepositoryAnalysis) {
  const commitTotal = Math.max(
    analysis.commitCount,
    analysis.commits.length,
  );
  const contributorTotal = Math.max(
    analysis.contributorCount,
    analysis.contributors.length,
  );
  return {
    commitTotal,
    contributorTotal,
    fileCount: analysis.fileCount,
    totalLines: analysis.totalLines,
    sourceFileCount: analysis.sourceFiles.length,
    framework: analysis.framework?.name ?? "Unknown",
  };
}
