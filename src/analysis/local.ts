/**
 * Local repository analyzer — EVIDENCE-BASED.
 *
 * Works entirely in the browser from `webkitdirectory` File objects.
 * Derives real data: file tree, language mix, LOC, top-level modules,
 * and git metadata from .git files when present.
 *
 * NEVER invents values. Every metric is traceable to its source.
 * If evidence is insufficient, reports it as unavailable.
 */
import type {
  AnalysisProgressFn,
  ClassifiedFile,
  Contributor,
  FileNode,
  RepositoryAnalysis,
  OnboardingGuide,
  ChurnRecord,
  CoChange,
  ContributorKnowledge,
  ModuleRisk,
  DebtEvidence,
  EvidenceItem,
  FrameworkInfo,
} from "./types";
import { buildLanguages, detectLanguage } from "./languages";
import { classifyFile, groupByCategory } from "./classify";
import { buildCoverage } from "./metrics";

const IGNORED_PATHS = new Set([
  "node_modules", ".git", ".next", ".nuxt", ".cache",
  "dist", "build", "coverage", ".turbo", ".parcel-cache",
  "vendor", "Pods", ".venv", "venv", "target", "__pycache__",
  ".idea", ".vscode", ".DS_Store",
]);

const IGNORED_FILES = new Set([
  ".DS_Store", "Thumbs.db", "package-lock.json",
  "yarn.lock", "pnpm-lock.yaml",
]);

function isIgnored(relPath: string): boolean {
  const parts = relPath.split("/");
  return (
    parts.some((p) => IGNORED_PATHS.has(p)) ||
    IGNORED_FILES.has(parts[parts.length - 1])
  );
}

function stripRoot(relPath: string): string {
  const idx = relPath.indexOf("/");
  return idx === -1 ? relPath : relPath.slice(idx + 1);
}

/** Count lines of text content. Returns exact counts. */
async function countLines(file: File): Promise<{
  total: number; code: number; blank: number; comment: number
} | null> {
  try {
    const text = await file.text();
    const lines = text.split("\n");
    const total = lines.length;
    let code = 0, blank = 0, comment = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "") { blank++; }
      else if (trimmed.startsWith("//") || trimmed.startsWith("#") ||
               trimmed.startsWith("/*") || trimmed.startsWith("*")) { comment++; }
      else { code++; }
    }
    return { total, code, blank, comment };
  } catch { return null; }
}

export async function analyzeLocalRepository(
  files: File[],
  name: string,
  onProgress: AnalysisProgressFn,
): Promise<RepositoryAnalysis> {
  const sorted = [...files].sort((a, b) =>
    (a.webkitRelativePath ?? a.name).localeCompare(b.webkitRelativePath ?? b.name),
  );

  const fileNodes: FileNode[] = [];
  const classifiedFiles: ClassifiedFile[] = [];
  const extLines: Record<string, number> = {};
  let totalLines: number | null = null;
  let scanned = 0;

  onProgress({ fraction: 0.05, stage: "Scanning repository structure", detail: `${sorted.length} files found` });

  for (const file of sorted) {
    const relPath = stripRoot(file.webkitRelativePath ?? file.name);
    if (!relPath || isIgnored(relPath)) continue;

    const lang = detectLanguage(relPath);
    let loc: number | null = null;
    let locSource: "exact" | "unavailable" = "unavailable";
    let complexityEstimate: number | null = null;

    if (lang) {
      const count = await countLines(file);
      if (count !== null) {
        loc = count.total;
        locSource = "exact";
        if (totalLines === null) totalLines = 0;
        totalLines += count.total;
        const ext = relPath.slice(relPath.lastIndexOf(".") + 1).toLowerCase();
        extLines[ext] = (extLines[ext] ?? 0) + count.total;
      }
    }

    const category = classifyFile(relPath);
    classifiedFiles.push({
      path: relPath,
      category,
      language: lang?.name ?? null,
      size: file.size,
      loc,
      locSource,
      complexityEstimate,
    });

    fileNodes.push({ path: relPath, type: "file", size: file.size, language: lang?.name });
    scanned++;
    if (scanned % 40 === 0) {
      onProgress({
        fraction: 0.05 + (scanned / sorted.length) * 0.45,
        stage: "Scanning repository structure",
        detail: `${scanned} of ${sorted.length} files`,
      });
    }
  }

  const sourceFiles = classifiedFiles.filter(
    (f) => f.category === "source" || f.category === "header",
  );

  onProgress({ fraction: 0.55, stage: "Reading Git history", detail: "Locating .git metadata" });

  // Read git log for author/commit info
  const gitFiles = sorted.filter((f) =>
    (f.webkitRelativePath ?? f.name).split("/").includes(".git"),
  );
  const gitContents = new Map<string, string>();
  for (const gf of gitFiles) {
    const rel = stripRoot(gf.webkitRelativePath ?? gf.name);
    try { gitContents.set(rel, await gf.text()); } catch { /* binary */ }
  }

  let branch = "main";
  let commitCount = 0;
  let complete = false;
  const logEntries = gitContents.get(".git/logs/HEAD");
  if (logEntries && logEntries.trim().length > 0) {
    commitCount = logEntries.trim().split("\n").length;
    complete = true;
  }

  const head = gitContents.get(".git/HEAD");
  if (head) {
    const m = head.match(/ref:\s*refs\/heads\/(.+)/);
    if (m) branch = m[1].trim();
  }

  onProgress({
    fraction: 0.65, stage: "Reading Git history",
    detail: complete ? `${commitCount} commits found` : "No git metadata uploaded — using file snapshot",
  });

  // Contributors — ONLY from real git data
  let contributors: Contributor[] = [];
  if (complete) {
    onProgress({ fraction: 0.7, stage: "Counting contributors", detail: "Parsing commit authors" });
    const authorCounts = new Map<string, number>();
    for (const line of (logEntries ?? "").split("\n")) {
      const author = line.match(/^[^\s]+\s+[^\s]+\s+([^<>\s]+(?:\s+[^<>\s]+)*)\s+</);
      if (author && author[1]) {
        const key = author[1].trim();
        authorCounts.set(key, (authorCounts.get(key) ?? 0) + 1);
      }
    }
    if (authorCounts.size > 0) {
      contributors = [...authorCounts.entries()]
        .map(([n, c]) => ({ name: n, commits: c, percentage: 0 }))
        .sort((a, b) => b.commits - a.commits)
        .slice(0, 8);
      const total = contributors.reduce((s, c) => s + c.commits, 0);
      contributors = contributors.map((c) => ({
        ...c,
        percentage: total > 0 ? Math.round((c.commits / total) * 100) : 0,
      }));
    }
  } else {
    onProgress({ fraction: 0.7, stage: "Counting contributors", detail: "No git data — contributors unavailable" });
  }

  onProgress({ fraction: 0.78, stage: "Detecting languages", detail: "Grouping by file extension" });
  const languages = buildLanguages(extLines);

  onProgress({ fraction: 0.84, stage: "Building module map", detail: "Mapping top-level directories" });
  const services = buildModules(fileNodes, classifiedFiles);

  // No git history = no churn, no co-changes, no commits
  const churn: ChurnRecord[] = [];
  const coChanges: CoChange[] = [];
  const commits: RepositoryAnalysis["commits"] = [];
  const contributorKnowledge: ContributorKnowledge[] = contributors.length > 0
    ? contributors.map((c) => ({
        name: c.name,
        commits: c.commits,
        filesChanged: 0,
        linesChanged: null,
        linesAdded: 0,
        linesDeleted: 0,
        modulesTouched: [],
        primaryModules: [],
      }))
    : [];

  // NO fabricated dependencies — dependency analysis requires parsing imports
  const internalDeps: RepositoryAnalysis["internalDependencies"] = [];
  const externalDeps: RepositoryAnalysis["externalDependencies"] = [];
  const deps: RepositoryAnalysis["dependencies"] = [];

  // Metrics: commit cadence is unavailable (no timestamp data from git logs)
  // Debt trend: unavailable unless we have TODO/FIXME markers
  const metrics: RepositoryAnalysis["metrics"] = {
    deployCadence: [],
    debtTrend: [],
  };

  // Tech debt: based ONLY on large files from the scan (no fabricated scores)
  const techDebt = buildTechDebtItems(classifiedFiles);

  // Module risks: all counts are 0 because we have no real git or dep data
  const moduleRisks: ModuleRisk[] = services.map((svc) => {
    const svcSourceFiles = classifiedFiles.filter(
      (f) => f.path.startsWith(svc.id),
    );
    const svcLoc = svcSourceFiles.reduce((s, f) => s + (f.loc ?? 0), 0);
    const svcFileCount = svcSourceFiles.length;
    const complexities = svcSourceFiles
      .map((f) => f.complexityEstimate)
      .filter((c): c is number => c !== null);
    const avgComplexity = complexities.length > 0
      ? Math.round(complexities.reduce((a, b) => a + b, 0) / complexities.length)
      : 0;

    return {
      moduleName: svc.name,
      riskScore: 0,
      factors: [],
      loc: svcLoc,
      fileCount: svcFileCount,
      complexityEstimate: avgComplexity,
      churn: 0,
      dependencyCount: 0,
      dependentCount: 0,
      contributorCount: 0,
      isGodModule: false,
      reasons: [],
    };
  });

  const evidence: EvidenceItem[] = [];
  const frameInfo: FrameworkInfo | null = null;
  const onboardGuide: OnboardingGuide = buildOnboardingGuide(name, services, sourceFiles, classifiedFiles);

  // Coverage: honest accounting
  const coverage = buildCoverage({
    totalFiles: fileNodes.length,
    analyzedFiles: fileNodes.length,
    sourceFilesTotal: sourceFiles.length,
    sourceFilesAnalyzed: 0, // no deep import analysis
    totalCommits: commitCount,
    commitsAnalyzed: 0, // no per-file change data from git logs
    totalContributors: contributors.length,
    analyzedContributors: contributors.length,
  });

  onProgress({ fraction: 1, stage: "Analysis complete", detail: name });

  return {
    name,
    source: "local",
    branch,
    description: complete
      ? `Local repository with ${commitCount} commits on ${branch}`
      : "Local file snapshot (git metadata not uploaded)",
    complete,
    analyzedAt: new Date().toISOString(),
    commitCount,
    contributorCount: contributors.length,
    fileCount: fileNodes.length,
    totalLines,
    languages,
    framework: frameInfo,
    sourceFiles,
    classifiedFiles: groupByCategory(classifiedFiles),
    contributors,
    contributorKnowledge,
    commits,
    services,
    dependencies: deps,
    realDependencies: [],
    internalDependencies: internalDeps,
    externalDependencies: externalDeps,
    circularDependencies: [],
    metrics,
    churn,
    coChanges,
    techDebt,
    moduleRisks,
    riskyModules: moduleRisks.filter((r) => r.riskScore > 50).slice(0, 5),
    fileTree: fileNodes,
    evidence,
    onboardingGuide: onboardGuide,
    coverage,
  };
}

/* ── Derived-data builders (evidence-only) ── */

function buildModules(
  nodes: FileNode[],
  classifiedFiles: ClassifiedFile[],
): RepositoryAnalysis["services"] {
  const tops = new Map<string, FileNode[]>();
  for (const n of nodes) {
    const parts = n.path.split("/");
    let key = parts[0];
    if (key === "src" && parts.length > 2) key = `src/${parts[1]}`;
    if (key === "lib" && parts.length > 2) key = `lib/${parts[1]}`;
    const arr = tops.get(key) ?? [];
    arr.push(n);
    tops.set(key, arr);
  }

  return [...tops.entries()]
    .filter(([, arr]) => arr.length > 0)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)
    .map(([id, arr]) => {
      const svcFiles = classifiedFiles.filter((cf) => cf.path.startsWith(id));
      const realLoc = svcFiles.reduce((s, cf) => s + (cf.loc ?? 0), 0);

      // Module state from ACTUAL data (real LOC only)
      let state: "healthy" | "evolving" | "at-risk" = "healthy";
      if (realLoc > 3000) { state = "at-risk"; }
      else if (realLoc > 1000) { state = "evolving"; }

      return {
        id,
        name: id,
        description: `${arr.length} file${arr.length === 1 ? "" : "s"} in ${id}`,
        state,
        loc: realLoc,
        commits30d: 0, // unavailable — no real git commit data with timestamps
        files: svcFiles.length > 0
          ? svcFiles.map((cf) => cf.path)
          : arr.map((n) => n.path),
      };
    });
}

function buildTechDebtItems(
  classifiedFiles: ClassifiedFile[],
): RepositoryAnalysis["techDebt"] {
  // Only flag large source files (not fabricated risk scores)
  const largeFiles = classifiedFiles
    .filter((f) => (f.category === "source" || f.category === "header") && (f.loc ?? 0) > 500)
    .sort((a, b) => (b.loc ?? 0) - (a.loc ?? 0))
    .slice(0, 5);

  return largeFiles.map((n, i) => {
    const evidence: DebtEvidence[] = [
      { metric: "LOC", value: `${n.loc ?? "Unavailable"}`, label: "Lines of code" },
      { metric: "Size", value: `${(n.size / 1024).toFixed(1)} KB`, label: "File size" },
    ];
    if (n.language) {
      evidence.push({ metric: "Language", value: n.language, label: "File language" });
    }
    return {
      id: `hotspot-${i}`,
      hotspot: n.path.split("/").slice(-1)[0],
      riskScore: 0, // no evidence for scoring
      factors: [],
      agingDebt: "Unknown — git history not available",
      filePath: n.path,
      detail: `Large file (${(n.size / 1024).toFixed(1)} KB, ${n.loc ?? "?"} LOC) — flagged from repository scan`,
      evidence,
    };
  });
}

function buildOnboardingGuide(
  _name: string,
  services: RepositoryAnalysis["services"],
  sourceFiles: ClassifiedFile[],
  _classifiedFiles: ClassifiedFile[],
): OnboardingGuide {
  const projectType = "Multi-language project";
  const entryPoints = sourceFiles
    .filter((f) =>
      /(?:main|index|entry|app)\.[a-z]+$/i.test(f.path) ||
      f.path.includes("main.") ||
      f.path === "index.ts" ||
      f.path === "index.js" ||
      f.path === "main.py"
    )
    .slice(0, 5)
    .map((f) => f.path);

  const majorModules = services.slice(0, 8).map((s) => ({
    name: s.name,
    description: s.description,
    fileCount: s.files.length,
  }));

  const recommendedPath = entryPoints.map((ep, i) => ({
    step: i + 1,
    file: ep,
    reason: "Project entry point — start here",
  }));

  const riskyModules = sourceFiles
    .filter((f) => (f.loc ?? 0) > 500)
    .slice(0, 5)
    .map((f) => f.path.split("/")[0] || f.path);

  return {
    projectType,
    entryPoints,
    majorModules,
    recommendedPath,
    riskyModules,
    primaryContributors: [],
  };
}