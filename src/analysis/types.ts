/**
 * Canonical analysis model produced by the repository analyzers.
 *
 * Every type here represents REAL, EVIDENCE-BASED data derived from
 * static analysis or git history — never fabricated relationships.
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
  loc: number;
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

export interface TechDebtItem {
  id: string;
  hotspot: string;
  riskScore: number;
  agingDebt: string;
  filePath: string;
  detail: string;
  /** Reasons broken down with evidence */
  evidence: DebtEvidence[];
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
  deployed: boolean;
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

/** Churn metrics for a single file */
export interface ChurnRecord {
  filePath: string;
  totalCommits: number;
  linesAdded: number;
  linesDeleted: number;
  recentChanges: number;
  changeFrequency: "high" | "moderate" | "low";
}

/** Co-change relationship between two files */
export interface CoChange {
  fileA: string;
  fileB: string;
  commitCount: number;
  totalCommits: number;
}

/** Knowledge map for a contributor */
export interface ContributorKnowledge {
  name: string;
  commits: number;
  filesChanged: number;
  linesChanged: number;
  modulesTouched: string[];
  primaryModules: string[];
}

/** Module-level risk metrics */
export interface ModuleRisk {
  moduleName: string;
  riskScore: number;
  loc: number;
  fileCount: number;
  complexity: number;
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
  source: "Static Analysis" | "Git History" | "Static Analysis + Git History" | "AI interpretation of analyzed evidence";
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
  totalLines: number;

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

  // Module / Service architecture
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

  // Risk
  techDebt: TechDebtItem[];
  moduleRisks: ModuleRisk[];
  riskyModules: ModuleRisk[];

  // Evolution
  fileTree: FileNode[];
  architectureSnapshots?: ArchitectureSnapshot[];

  // Insights
  evidence: EvidenceItem[];

  // Onboarding
  onboardingGuide?: OnboardingGuide;
}

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