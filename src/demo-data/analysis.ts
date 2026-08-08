/**
 * Demo RepositoryAnalysis for vertex/control-plane.
 *
 * Built from the typed demo data modules so workspace screens can
 * render without running a real analysis. Swap this module when
 * connecting real repository ingestion.
 */
import type {
  RepositoryAnalysis,
  ClassifiedFile,
  Contributor,
  FileNode,
  ModuleRisk,
  RiskFactor,
  ChurnRecord,
  CoChange,
  ContributorKnowledge,
  RealDependency,
  InternalDependencyGroup,
  ExternalDependencyGroup,
  CircularDependency,
  EvidenceItem,
  OnboardingGuide,
} from "../analysis/types";
import { services } from "./services";
import { dependencies } from "./dependencies";
import { techDebt } from "./techDebt";
import { commits } from "./commits";
import { metrics } from "./metrics";

/* ── Build derived data ────────────────────────────────────────── */

/** Classified files built from demo service file lists. */
const sourceFiles: ClassifiedFile[] = [];
const fileTree: FileNode[] = [];
const extLines: Record<string, number> = {};
const contributors: Contributor[] = [
  { name: "mira.k", commits: 3, percentage: 38 },
  { name: "devon.c", commits: 3, percentage: 38 },
  { name: "sana.r", commits: 2, percentage: 25 },
];

for (const svc of services) {
  for (const f of svc.files) {
    const ext = f.split(".").pop()?.toLowerCase() ?? "";
    const lang =
      ext === "ts"
        ? "TypeScript"
        : ext === "go"
          ? "Go"
          : ext === "yaml"
            ? "YAML"
            : null;
    extLines[ext] = (extLines[ext] ?? 0) + 200;
    sourceFiles.push({
      path: f,
      category: "source",
      language: lang,
      size: 4096,
      loc: 200,
      locSource: "exact",
      complexityEstimate: 5,
    });
    fileTree.push({
      path: f,
      type: "file",
      size: 4096,
      language: lang ?? undefined,
    });
  }
}

// Add test files
sourceFiles.push({
  path: "tests/billing/pipeline.integration.test.ts",
  category: "test",
  language: "TypeScript",
  size: 2048,
  loc: 120,
  locSource: "exact",
  complexityEstimate: 3,
});
fileTree.push({
  path: "tests/billing/pipeline.integration.test.ts",
  type: "file",
  size: 2048,
  language: "TypeScript",
});

// Add deploy files
for (const f of ["deploy/control-plane/values.yaml", "deploy/control-plane/Chart.yaml"]) {
  sourceFiles.push({
    path: f,
    category: "config",
    language: "YAML",
    size: 512,
    loc: 30,
    locSource: "exact",
    complexityEstimate: 1,
  });
  fileTree.push({ path: f, type: "file", size: 512, language: "YAML" });
}

const languages = [
  { name: "TypeScript", percentage: 68, color: "#3178c6" },
  { name: "Go", percentage: 22, color: "#00add8" },
  { name: "YAML", percentage: 10, color: "#cb171e" },
];

/* Build real dependencies from the demo edge list (fabricated paths) */
const realDependencies: RealDependency[] = [];
for (const dep of dependencies) {
  realDependencies.push({
    fromFile: `${dep.from}/main.ts`,
    toFile: `${dep.to}/api.ts`,
    kind: "import",
    evidence: dep.reason ?? `import from ${dep.from} to ${dep.to}`,
    external: false,
  });
}

const internalDependencies: InternalDependencyGroup[] = dependencies.map((d) => ({
  from: `${d.from}/main.ts`,
  to: `${d.to}/api.ts`,
  evidence: d.reason ?? `Dependency from ${d.from} to ${d.to}`,
}));

const externalDependencies: ExternalDependencyGroup[] = [
  { name: "express", imports: ["api-gateway/main.ts", "control-plane/api.ts"] },
  { name: "redis", imports: ["scheduler/lock.ts", "ingest/buffer.ts"] },
  { name: "stripe", imports: ["billing/payments.ts"] },
];

const circularDependencies: CircularDependency[] = [
  { cycle: ["billing", "worker", "control-plane", "billing"] },
];

/* Module risks derived from service data */
const moduleRisks: ModuleRisk[] = services.map((svc) => {
  const depFrom = dependencies.filter((d) => d.from === svc.id);
  const depTo = dependencies.filter((d) => d.to === svc.id);
  const factors: RiskFactor[] = [];

  if (svc.loc > 20000) {
    factors.push({
      name: "Size",
      contribution: 30,
      evidence: {
        metric: "LOC",
        value: svc.loc,
        label: "Lines of code",
        explanation: `Large module (${svc.loc} LOC) — higher complexity risk`,
        confidence: "high",
      },
    });
  }
  if (depFrom.some((d) => d.risk === "high")) {
    factors.push({
      name: "Coupling",
      contribution: 25,
      evidence: {
        metric: "High-risk outgoing deps",
        value: depFrom.filter((d) => d.risk === "high").length,
        label: "High-risk outgoing dependencies",
        explanation: "Dependency edges with high risk rating",
        confidence: "high",
      },
    });
  }

  const churn = svc.commits30d;
  if (churn > 40) {
    factors.push({
      name: "Churn",
      contribution: 20,
      evidence: {
        metric: "30d commits",
        value: churn,
        label: "Commit count (30 days)",
        explanation: `High activity (${churn} commits/30d) — elevated instability risk`,
        confidence: "high",
      },
    });
  }

  const riskScore = factors.reduce((s, f) => s + f.contribution, 0);
  const reasons = factors.map((f) => `${f.name}: +${f.contribution} (${f.evidence.explanation})`);

  return {
    moduleName: svc.name,
    riskScore,
    factors,
    loc: svc.loc,
    fileCount: svc.files.length,
    complexityEstimate: 8,
    churn,
    dependencyCount: depFrom.length,
    dependentCount: depTo.length,
    contributorCount: 2,
    isGodModule: svc.loc > 25000,
    reasons,
  };
});

const churn: ChurnRecord[] = services.map((svc) => ({
  filePath: svc.files[0],
  totalCommits: svc.commits30d,
  linesAdded: svc.loc,
  linesDeleted: Math.round(svc.loc * 0.1),
  totalChanges: Math.round(svc.loc * 1.1),
  recentChanges: Math.round(svc.commits30d * 0.6),
  changeFrequency: svc.commits30d > 40 ? "high" : svc.commits30d > 20 ? "moderate" : "low",
  firstChanged: "2024-11-01",
  lastChanged: "2025-02-14",
}));

const coChanges: CoChange[] = [
  { fileA: "billing/payments.ts", fileB: "billing/metering.ts", commitCount: 8, totalCommits: 12 },
  { fileA: "control-plane/orchestrator.ts", fileB: "scheduler/dispatcher.ts", commitCount: 5, totalCommits: 10 },
];

const contributorKnowledge: ContributorKnowledge[] = contributors.map((c) => ({
  name: c.name,
  commits: c.commits,
  filesChanged: 4,
  linesChanged: 1200,
  linesAdded: 800,
  linesDeleted: 400,
  modulesTouched: services.slice(0, 3).map((s) => s.name),
  primaryModules: [services[0].name],
}));

const evidence: EvidenceItem[] = [
  {
    insight: "Billing module shows elevated structural risk",
    source: "Static Analysis",
    facts: [
      `22,760 LOC across 5 files`,
      "3 high-risk outgoing dependency edges",
      "Unbounded retry loop with no circuit breaker",
    ],
    inference:
      "Billing is the highest-risk module — prioritize incremental refactoring with a focus on the retry pipeline.",
  },
  {
    insight: "Cyclic dependency detected: billing → worker → control-plane",
    source: "Static Analysis",
    facts: [
      "billing depends on worker",
      "worker depends on control-plane",
      "control-plane depends on billing",
    ],
    inference:
      "The cycle forces synchronized deploys and increases cascading failure surface area.",
  },
];

const onboardingGuide: OnboardingGuide = {
  projectType: "Microservices (6 services)",
  entryPoints: ["api-gateway/main.ts", "control-plane/orchestrator.ts"],
  majorModules: services.map((s) => ({
    name: s.name,
    description: s.description,
    fileCount: s.files.length,
  })),
  recommendedPath: [
    { step: 1, file: "api-gateway/main.ts", reason: "Primary entry point for external traffic" },
    { step: 2, file: "control-plane/orchestrator.ts", reason: "Core orchestration logic" },
  ],
  riskyModules: ["billing", "control-plane"],
  primaryContributors: [
    { module: "api-gateway", people: ["sana.r"] },
    { module: "billing", people: ["mira.k", "devon.c"] },
  ],
};

const classifiedFiles = [
  { category: "source" as const, count: sourceFiles.length, files: sourceFiles.map((f) => f.path) },
  { category: "test" as const, count: 1, files: ["tests/billing/pipeline.integration.test.ts"] },
  { category: "config" as const, count: 2, files: ["deploy/control-plane/values.yaml", "deploy/control-plane/Chart.yaml"] },
];

const totalLines = sourceFiles.reduce((s, f) => s + (f.loc ?? 0), 0);

export const demoAnalysis: RepositoryAnalysis = {
  name: "vertex/control-plane",
  source: "github",
  branch: "main",
  description: "Fictional microservices codebase — 6 services, realistic dependency graph",
  complete: true,
  analyzedAt: new Date().toISOString(),
  commitCount: commits.length,
  contributorCount: contributors.length,
  fileCount: fileTree.length,
  totalLines,
  languages,
  framework: {
    name: "TypeScript (Express)",
    buildSystem: "npm",
    languages: ["TypeScript", "Go"],
    confidence: "high",
    evidence: ["Detected package.json", "Detected Go module files"],
  },
  sourceFiles,
  classifiedFiles,
  contributors,
  contributorKnowledge,
  commits: commits.map((c) => ({
    hash: c.hash,
    message: c.message,
    author: c.author,
    date: c.date,
    files: c.files,
  })),
  services,
  dependencies,
  realDependencies,
  internalDependencies,
  externalDependencies,
  circularDependencies,
  metrics: {
    deployCadence: metrics.deployCadence,
    debtTrend: metrics.debtTrend,
  },
  churn,
  coChanges,
  techDebt: techDebt.map((t) => ({
    id: t.id,
    hotspot: t.hotspot,
    riskScore: t.riskScore,
    factors: [],
    agingDebt: t.agingDebt,
    filePath: t.filePath,
    detail: t.detail,
    evidence: [{ metric: "Risk Score", value: String(t.riskScore), label: "Composite risk score" }],
  })),
  moduleRisks,
  riskyModules: moduleRisks.filter((r) => r.riskScore > 30).slice(0, 5),
  fileTree,
  evidence,
  onboardingGuide,
  coverage: {
    files: { total: fileTree.length, analyzed: fileTree.length, skipped: 0 },
    dependencies: {
      sourceFilesTotal: sourceFiles.length,
      sourceFilesAnalyzed: sourceFiles.length,
    },
    history: {
      totalCommits: commits.length,
      commitsAnalyzed: commits.length,
      label: `${commits.length} / ${commits.length} commits analyzed`,
    },
    contributors: {
      total: contributors.length,
      analyzed: contributors.length,
    },
    confidence: "high",
  },
};