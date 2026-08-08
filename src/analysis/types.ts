/**
 * Canonical analysis model produced by the repository analyzers.
 *
 * Every type here represents REAL, EVIDENCE-BASED data derived from
 * static analysis or git history — never fabricated relationships.
 *
 * ACCURACY > HONESTY > PERFORMANCE > FEATURES > UI POLISH
 */

export type ServiceState = "healthy" | "evolving" | "at-risk";
export type DependencyRisk = "none" | "moderate" | "high";

/** Classification of a file in the repository */
export type FileCategory =
  | "source"
  | "header"
  | "build"
  | "config"
  | "documentation"
  | "test"
  | "asset"
  | "generated"
  | "data"
  | "unknown";

export interface ClassifiedFile {
  path: string;
  category: FileCategory;
  language: string | null;
  size: number;
  /** Lines of code. This is EXACT if we read the file, or null if not analyzed. */
  loc: number | null;
  /** If loc is estimated, this tells you how */
  locSource: "exact" | "estimated" | "unavailable";
  /** Structural complexity estimate (null = not analyzed, 0 = trivial file) */
  complexityEstimate: number | null;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  state: ServiceState;
  loc: number;
  commits30d: number;
  /** Files that belong to this module */
  files: string[];
}

export interface Dependency {
  from: string;
  to: string;
  risk: DependencyRisk;
  reason?: string;
}

/** A dependency with a specific evidence source */
export interface RealDependency {
  /** Consumer file path (relative to repo root) */
  fromFile: string;
  /** Provider file path (relative to repo root) */
  toFile: string;
  /** Type of dependency */
  kind: "import" | "include" | "require";
  /** The exact source line or pattern that was parsed, e.g. '#include "mainwindow.h"' */
  evidence: string;
  /** Whether the target is an external library (e.g. QtWidgets, react) vs internal file */
  external: boolean;
  /** If external, the library/dependency name */
  externalName?: string;
}

export interface InternalDependencyGroup {
  from: string;
  to: string;
  evidence: string;
}

export interface ExternalDependencyGroup {
  name: string;
  imports: string[];
}

export interface CircularDependency {
  cycle: string[];
}

/**
 * Evidence that backs a single risk factor.
 * Every measurable claim should be traceable to its source.
 */
export interface RiskEvidence {
  metric: string;
  value: string | number;
  label: string;
  /** Human-readable explanation of why this contributes to risk */
  explanation: string;
  /** How confident we are in this measurement */
  confidence: "high" | "medium" | "low";
}

/**
 * A single risk factor with its supporting evidence.
 */
export interface RiskFactor {
  name: string;
  contribution: number; // 0-100 weight contribution to overall score
  evidence: RiskEvidence;
}

export interface TechDebtItem {
  id: string;
  hotspot: string;
  riskScore: number;
  /** Evidence-based reasons broken down with data sources */
  factors: RiskFactor[];
  agingDebt: string;
  filePath: string;
  detail: string;
  /** Legacy: use factors instead */
  evidence: DebtEvidence[];
  /** When this risk pattern was first observed (from git history) */
  firstObserved?: string;
  /** How long the module has remained elevated risk (from git history) */
  riskDurationDays?: number;
}

export interface DebtEvidence {
  metric: string;
  value: string;
  label: string;
}

export interface Commit {
  hash: string;
  message: string;
  author: string;
  date: string;
  files: string[];
  /** File-level change metadata from GitHub API */
  fileChanges?: FileChange[];
}

/** File-level change metadata returned by GitHub API */
export interface FileChange {
  filename: string;
  status: "added" | "modified" | "removed" | "renamed" | "copied" | "changed";
  additions: number;
  deletions: number;
  changes: number;
  previous_filename?: string;
}

export interface MetricPoint {
  date: string;
  value: number;
}

export interface Metrics {
  deployCadence: MetricPoint[];
  debtTrend: MetricPoint[];
}

export interface Language {
  name: string;
  percentage: number;
  color: string;
}

export interface Contributor {
  name: string;
  commits: number;
  percentage: number;
}

export interface FileNode {
  path: string;
  type: "dir" | "file";
  size: number;
  language?: string;
}

/** Churn metrics for a single file — calculated from REAL commit data */
export interface ChurnRecord {
  filePath: string;
  totalCommits: number;
  linesAdded: number;
  linesDeleted: number;
  totalChanges: number;
  recentChanges: number;
  changeFrequency: "high" | "moderate" | "low";
  /** When this file was first observed in git history */
  firstChanged?: string;
  /** Most recent change date */
  lastChanged?: string;
}

/** Co-change relationship between two files */
export interface CoChange {
  fileA: string;
  fileB: string;
  commitCount: number;
  totalCommits: number;
  /** Jaccard similarity coefficient — normalized coupling metric */
  jaccard?: number;
  /** Whether there is insufficient commit history for a reliable reading */
  insufficientEvidence?: boolean;
}

/** Knowledge map for a contributor — evidence-based */
export interface ContributorKnowledge {
  name: string;
  commits: number;
  filesChanged: number;
  /** Total lines changed. This is EXACT if we have file change data, or null if unknown. */
  linesChanged: number | null;
  linesAdded: number;
  linesDeleted: number;
  modulesTouched: string[];
  primaryModules: string[];
  firstContribution?: string;
  mostRecentContribution?: string;
}

/**
 * Analysis-wide coverage tracking.
 * Every metric should report how much of the repository was actually examined.
 */
export interface AnalysisCoverage {
  /** File analysis coverage */
  files: {
    total: number;
    analyzed: number;
    skipped: number;
  };
  /** Dependency analysis coverage */
  dependencies: {
    sourceFilesTotal: number;
    sourceFilesAnalyzed: number;
  };
  /** Git history coverage */
  history: {
    totalCommits: number;
    commitsAnalyzed: number;
    /** e.g. "Detailed history: 486 / 1,204 commits analyzed" */
    label: string;
  };
  /** Contributor coverage */
  contributors: {
    total: number;
    analyzed: number;
  };
  /** Overall confidence level */
  confidence: "high" | "medium" | "low";
}

/** Module-level risk metrics — every value comes from real evidence */
export interface ModuleRisk {
  moduleName: string;
  riskScore: number;
  /** Breakdown of risk factors with evidence */
  factors: RiskFactor[];
  loc: number;
  fileCount: number;
  /** Structural complexity estimate — NOT cyclomatic complexity */
  complexityEstimate: number;
  churn: number;
  dependencyCount: number;
  dependentCount: number;
  contributorCount: number;
  isGodModule: boolean;
  reasons: string[];
}

/** Architecture snapshot at a point in time */
export interface ArchitectureSnapshot {
  period: string;
  modules: {
    name: string;
    fileCount: number;
  }[];
}

/** Result of framework detection */
export interface FrameworkInfo {
  name: string;
  buildSystem: string | null;
  languages: string[];
  confidence: "high" | "medium" | "low";
  evidence: string[];
}

export interface EvidenceItem {
  insight: string;
  source: "Static Analysis" | "Git History" | "Static Analysis + Git History";
  facts: string[];
  inference: string;
}

export interface OnboardingGuide {
  projectType: string;
  entryPoints: string[];
  majorModules: { name: string; description: string; fileCount: number }[];
  recommendedPath: { step: number; file: string; reason: string }[];
  riskyModules: string[];
  primaryContributors: { module: string; people: string[] }[];
}

export interface RepositoryAnalysis {
  name: string;
  source: "local" | "github";
  branch: string;
  description: string;
  complete: boolean;
  analyzedAt: string;

  // Repository metadata
  commitCount: number;
  contributorCount: number;
  fileCount: number;
  totalLines: number | null; // null if unavailable

  // Language and framework
  languages: Language[];
  framework: FrameworkInfo | null;

  // File classification
  sourceFiles: ClassifiedFile[];
  classifiedFiles: { category: FileCategory; count: number; files: string[] }[];

  // Derived data
  contributors: Contributor[];
  contributorKnowledge: ContributorKnowledge[];
  commits: Commit[];

  // Module / Architecture regions (not necessarily "services")
  services: Service[];
  dependencies: Dependency[];

  // Real dependency analysis
  realDependencies: RealDependency[];
  internalDependencies: InternalDependencyGroup[];
  externalDependencies: ExternalDependencyGroup[];
  circularDependencies: CircularDependency[];

  // Metrics
  metrics: Metrics;
  churn: ChurnRecord[];
  coChanges: CoChange[];

  // Risk — evidence-backed
  techDebt: TechDebtItem[];
  moduleRisks: ModuleRisk[];
  riskyModules: ModuleRisk[];

  // Evolution
  fileTree: FileNode[];
  architectureSnapshots?: ArchitectureSnapshot[];

  // Insights — evidence only, never AI-fabricated
  evidence: EvidenceItem[];

  // Onboarding
  onboardingGuide?: OnboardingGuide;

  // Coverage — how complete is this analysis?
  coverage: AnalysisCoverage;
}

/**
 * Configurable risk scoring weights.
 * All magic numbers are centralized here.
 */
export const RISK_WEIGHTS = {
  complexity: 30,
  churn: 25,
  coupling: 25,
  size: 10,
  busFactor: 10,
} as const;

export interface AnalysisProgress {
  fraction: number;
  stage: string;
  detail?: string;
  /** Optional list of checkmarks to show progress details */
  checks?: string[];
}

export type AnalysisProgressFn = (progress: AnalysisProgress) => void;

export interface AnalysisResult {
  analysis: RepositoryAnalysis;
}