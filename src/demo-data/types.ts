/**
 * Canonical types for the Vertex data layer.
 *
 * Screens must consume ONLY these types (via `./index.ts`) — never mock
 * values directly. Swapping in real repository data later = replacing the
 * modules in `src/demo-data/` behind these same interfaces.
 */

export type ServiceState = "healthy" | "evolving" | "at-risk";

export interface Service {
  /** Stable identifier, e.g. "api-gateway" */
  id: string;
  /** Human-readable service name */
  name: string;
  description: string;
  /** Semantic state driving node color (emerald / amber / rust) */
  state: ServiceState;
  /** Lines of code — data value, rendered in mono */
  loc: number;
  /** Commits in the trailing 30 days */
  commits30d: number;
  /** Files that belong to this module */
  files: string[];
}

export type DependencyRisk = "none" | "moderate" | "high";

export interface Dependency {
  /** Consumer service id */
  from: string;
  /** Provider service id */
  to: string;
  risk: DependencyRisk;
  /** Why the edge is risky (required when risk !== "none") */
  reason?: string;
}

export interface TechDebtItem {
  id: string;
  /** Hotspot name, e.g. "Billing Retry Loop" */
  hotspot: string;
  /** 0–100 risk score */
  riskScore: number;
  /** How long the debt has been aging, e.g. "47 days" */
  agingDebt: string;
  /** File path (mono) */
  filePath: string;
  /** One-line explanation */
  detail: string;
}

export interface Commit {
  /** Short hash, e.g. "3f1a9c2" */
  hash: string;
  message: string;
  author: string;
  /** ISO date string */
  date: string;
  /** Affected file paths (mono) */
  files: string[];
}

export interface MetricPoint {
  /** ISO date string */
  date: string;
  value: number;
}

export interface Metrics {
  /** Daily commit counts (from git history, NOT deployments) */
  commitActivity: MetricPoint[];
  /** Daily cumulative debt-score trend */
  debtTrend: MetricPoint[];
}