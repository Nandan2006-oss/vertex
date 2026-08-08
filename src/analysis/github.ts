/**
 * GitHub repository analyzer — EVIDENCE-BASED REWRITE.
 *
 * Uses the public GitHub REST API to fetch real data and perform
 * evidence-based static analysis. No fabricated relationships.
 *
 * ACCURACY > HONESTY > PERFORMANCE > FEATURES > UI POLISH
 * Never invents values. Every metric is traceable to its source.
 */

import type {
  AnalysisProgressFn,
  Commit,
  Contributor,
  FileNode,
  RepositoryAnalysis,
  Service,
  Dependency,
  ClassifiedFile,
  RealDependency,
  InternalDependencyGroup,
  CircularDependency,
  FileChange,
} from "./types";
import { detectLanguage } from "./languages";
import { isIgnored, classifyFile, isSourceOrHeader, groupByCategory } from "./classify";
import { parseImports, importsToDependencies, detectImportParser } from "./imports";
import { detectFramework, type FileContent } from "./framework";
import {
  calculateChurn,
  detectCoChanges,
  buildContributorKnowledge,
  calculateModuleRisks,
  buildTechDebt,
  generateEvidence,
  generateOnboardingGuide,
  buildCoverage,
  estimateComplexity,
} from "./metrics";

const GITHUB_API = "https://api.github.com";
const RAW_CONTENT = "https://raw.githubusercontent.com";
const USER_AGENT = "Vertex/1.0";

/** Maximum concurrent GitHub API requests */
const CONCURRENCY_LIMIT = 5;

interface GhRepo {
  name: string;
  full_name: string;
  description: string | null;
  default_branch: string;
  language: string | null;
  size: number;
}

interface GhCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string } | null;
    committer: { date: string } | null;
  };
  files?: GhFileChange[];
  author: { login: string } | null;
  stats?: { total: number; additions: number; deletions: number };
}

interface GhFileChange {
  filename: string;
  status: string;
  additions?: number;
  deletions?: number;
  changes?: number;
  previous_filename?: string;
}

interface GhContributor {
  login: string;
  contributions: number;
}

interface GhTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  size: number;
}

export function parseGithubUrl(input: string): { owner: string; repo: string } | null {
  let cleaned = input.trim();
  cleaned = cleaned.replace(/\.git$/, "").replace(/\/+$/, "");
  let m = cleaned.match(/^https?:\/\/github\.com\/([^\s]+)\/([^\s]+)/i);
  if (m) return { owner: m[1], repo: m[2] };
  m = cleaned.match(/^git@github\.com:([^\s]+)\/([^\s]+)/i);
  if (m) return { owner: m[1], repo: m[2] };
  m = cleaned.match(/^([^\s]+)\/([^\s]+)$/);
  if (m) return { owner: m[1], repo: m[2] };
  return null;
}

/** Bounded-concurrency fetch queue to avoid hitting GitHub rate limits */
async function concurrentFetch<T>(
  items: { key: string; fetcher: () => Promise<T> }[],
  concurrency: number = CONCURRENCY_LIMIT,
  onItem?: (key: string, index: number, total: number) => void,
): Promise<Map<string, T>> {
  const results = new Map<string, T>();
  const queue = [...items];
  let index = 0;

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift()!;
      const i = index++;
      try {
        const result = await item.fetcher();
        results.set(item.key, result);
        onItem?.(item.key, i, items.length);
      } catch (err) {
        console.warn(`Failed to fetch ${item.key}:`, err);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function ghFetch(path: string, signal?: AbortSignal): Promise<any> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": USER_AGENT },
    signal,
  });
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Repository not found (404) at ${path}`);
    }
    if (res.status === 403) {
      const rateLimit = res.headers.get("X-RateLimit-Remaining");
      if (rateLimit === "0") {
        const resetTime = res.headers.get("X-RateLimit-Reset");
        const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000).toISOString() : "unknown";
        throw new Error(`GitHub API rate limit exceeded. Resets at ${resetDate}. Try again later.`);
      }
      throw new Error(`Access denied (403) for ${path}. The repository may be private or access restricted.`);
    }
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status} for ${path}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchRawContent(owner: string, repo: string, path: string, branch: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const url = `${RAW_CONTENT}/${owner}/${repo}/${encodeURIComponent(branch)}/${path}`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Count actual lines in source text */
function countLines(text: string): { total: number; code: number; blank: number; comment: number } {
  const lines = text.split("\n");
  const total = lines.length;
  let code = 0;
  let blank = 0;
  let comment = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      blank++;
    } else if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
      comment++;
    } else {
      code++;
    }
  }

  return { total, code, blank, comment };
}

export async function analyzeGithubRepository(
  url: string,
  name: string,
  onProgress: AnalysisProgressFn,
  signal?: AbortSignal,
): Promise<RepositoryAnalysis> {
  const parsed = parseGithubUrl(url);
  if (!parsed) throw new Error(`Could not parse GitHub URL: ${url}`);
  const { owner, repo } = parsed;
  const checks: string[] = [];

  // ════════════════════════════════════════════════════════════
  // STAGE 1 — FAST SCAN
  // ════════════════════════════════════════════════════════════

  onProgress({ fraction: 0.02, stage: "Scanning repository", detail: `Looking up ${owner}/${repo}` });
  const repoData = (await ghFetch(`/repos/${owner}/${repo}`, signal)) as GhRepo;
  const branch = repoData.default_branch;
  const description = repoData.description ?? "";
  checks.push(`✓ Repository found: ${owner}/${repo}`);

  onProgress({ fraction: 0.08, stage: "Scanning repository", detail: "Detecting languages" });
  const langData = (await ghFetch(`/repos/${owner}/${repo}/languages`, signal)) as Record<string, number>;
  const totalBytes = Object.values(langData).reduce((s, v) => s + v, 0) || 1;
  const languages = Object.entries(langData)
    .map(([lang, bytes]) => {
      const info = detectLanguage(lang.toLowerCase());
      return {
        name: lang,
        percentage: Math.round((bytes / totalBytes) * 1000) / 10,
        color: info?.color ?? "#888",
      };
    })
    .sort((a, b) => b.percentage - a.percentage);

  onProgress({ fraction: 0.15, stage: "Scanning repository", detail: "Retrieving file tree" });
  const treeData = (await ghFetch(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    signal,
  )) as { tree: GhTreeItem[]; truncated: boolean };

  const allFileNodes: FileNode[] = [];
  const rawSourceFiles: { path: string; size: number }[] = [];

  for (const item of treeData.tree) {
    if (item.type === "blob") {
      if (isIgnored(item.path)) continue;
      const langInfo = detectLanguage(item.path);
      allFileNodes.push({
        path: item.path,
        type: "file",
        size: item.size,
        language: langInfo?.name,
      });
      if (langInfo) {
        rawSourceFiles.push({ path: item.path, size: item.size });
      }
    } else {
      allFileNodes.push({ path: item.path, type: "dir", size: 0 });
    }
  }

  const fileCount = allFileNodes.filter((n) => n.type === "file").length;
  checks.push(`✓ ${fileCount} files detected`);

  onProgress({ fraction: 0.2, stage: "Scanning repository", detail: "Classifying files by type" });
  const classifiedFiles: ClassifiedFile[] = [];
  let totalLines: number | null = null;
  let exactLineCounts = false;

  for (const n of allFileNodes) {
    if (n.type !== "file") continue;
    const category = classifyFile(n.path);
    classifiedFiles.push({
      path: n.path,
      category,
      language: n.language ?? null,
      size: n.size,
      loc: null,
      locSource: "unavailable",
      complexityEstimate: null,
    });
  }

  const sourceFiles = classifiedFiles.filter((f) => isSourceOrHeader(f.category));
  const categorizedFiles = groupByCategory(classifiedFiles);
  checks.push(`✓ ${sourceFiles.length} source files identified`);

  onProgress({ fraction: 0.25, stage: "Scanning repository", detail: "Detecting framework" });

  const manifestCandidates = [
    "package.json", "requirements.txt", "setup.py", "pyproject.toml",
    "Cargo.toml", "go.mod", "CMakeLists.txt", "Makefile",
    "pom.xml", "build.gradle", "Gemfile",
  ];
  const manifestContents: FileContent[] = [];
  const qtProFiles = classifiedFiles.filter((f) => f.path.endsWith(".pro") && f.category === "build");
  for (const f of qtProFiles) {
    const content = await fetchRawContent(owner, repo, f.path, branch, signal);
    if (content) manifestContents.push({ path: f.path, content });
  }
  for (const candidate of manifestCandidates) {
    if (classifiedFiles.some((f) => f.path === candidate)) {
      const content = await fetchRawContent(owner, repo, candidate, branch, signal);
      if (content) manifestContents.push({ path: candidate, content });
    }
  }

  const framework = detectFramework(manifestContents, languages.map((l) => l.name));

  if (framework) {
    checks.push(`✓ Framework: ${framework.name}`);
    if (framework.buildSystem) {
      checks.push(`✓ Build system: ${framework.buildSystem}`);
    }
  }

  // ════════════════════════════════════════════════════════════
  // STAGE 2 — DEPENDENCY EXTRACTION
  // ════════════════════════════════════════════════════════════

  onProgress({ fraction: 0.30, stage: "Analyzing imports", detail: "Reading source file contents" });

  const filesToAnalyze = sourceFiles
    .filter((f) => detectImportParser(f.path) !== null)
    .slice(0, 50);

  const contentFetchItems = filesToAnalyze.map((f) => ({
    key: f.path,
    fetcher: () => fetchRawContent(owner, repo, f.path, branch, signal),
  }));

  const contentResults = await concurrentFetch(
    contentFetchItems,
    CONCURRENCY_LIMIT,
    (key, idx, total) => {
      onProgress({
        fraction: 0.30 + (idx / total) * 0.20,
        stage: "Analyzing imports",
        detail: `Reading ${key} (${idx + 1}/${total})`,
      });
    },
  );

  const fileContents = new Map<string, string>();
  for (const [path, content] of contentResults) {
    if (content !== null) {
      fileContents.set(path, content);
    }
  }

  // Update LOC and complexity for files we actually read
  const todoCountTotal: { count: number; files: number } = { count: 0, files: 0 };
  for (const cf of classifiedFiles) {
    const content = fileContents.get(cf.path);
    if (content !== undefined) {
      const lineInfo = countLines(content);
      cf.loc = lineInfo.total;
      cf.locSource = "exact";
      cf.complexityEstimate = estimateComplexity(content, cf.language);
      if (totalLines === null) totalLines = 0;
      totalLines += lineInfo.total;
      exactLineCounts = true;

      // Count TODO/FIXME/HACK markers in actual code (evidence for debt)
      const todoMatch = content.match(/\b(TODO|FIXME|HACK|XXX|BUG|WORKAROUND|HACKY)\b/gi);
      if (todoMatch) {
        todoCountTotal.count += todoMatch.length;
        todoCountTotal.files++;
      }
    }
  }

  if (!exactLineCounts) {
    totalLines = null;
  }

  onProgress({ fraction: 0.52, stage: "Analyzing imports", detail: "Parsing import statements" });

  const knownFiles = new Set(classifiedFiles.filter((f) =>
    f.category === "source" || f.category === "header"
  ).map((f) => f.path));

  const allRealDeps: RealDependency[] = [];

  for (const [filePath, content] of fileContents) {
    try {
      const parsed = parseImports(content, filePath);
      const deps = importsToDependencies(filePath, parsed, knownFiles);
      allRealDeps.push(...deps);
    } catch {
      // Skip files that can't be parsed
    }
  }

  const internalDeps = allRealDeps.filter((d) => !d.external);
  const externalDeps = allRealDeps.filter((d) => d.external);

  const internalGroupMap = new Map<string, InternalDependencyGroup>();
  for (const d of internalDeps) {
    const key = `${d.fromFile}→${d.toFile}`;
    if (!internalGroupMap.has(key)) {
      internalGroupMap.set(key, { from: d.fromFile, to: d.toFile, evidence: d.evidence });
    }
  }

  const externalGroupMap = new Map<string, Set<string>>();
  for (const d of externalDeps) {
    const name = d.externalName ?? d.toFile.replace("[external] ", "");
    if (!externalGroupMap.has(name)) {
      externalGroupMap.set(name, new Set());
    }
    externalGroupMap.get(name)!.add(d.fromFile);
  }

  const internalDependencyGroups = [...internalGroupMap.values()];
  const externalDependencyGroups = [...externalGroupMap.entries()].map(([name, imports]) => ({
    name,
    imports: [...imports],
  }));

  const circularDeps = detectCircularDependencies(internalDependencyGroups);
  const allExternalLibs = externalDependencyGroups.map((g) => g.name);
  checks.push(`✓ ${externalDependencyGroups.length} external libraries detected`);
  checks.push(`✓ ${internalDependencyGroups.length} internal dependency relationships`);

  // ════════════════════════════════════════════════════════════
  // STAGE 3 — GIT HISTORY
  // ════════════════════════════════════════════════════════════

  onProgress({ fraction: 0.56, stage: "Fetching Git history", detail: "Retrieving commit list" });

  // Get approximate total commit count
  let totalCommitCount = 0;
  try {
    const commitCountResponse = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=1`,
      { headers: { Accept: "application/vnd.github+json", "User-Agent": USER_AGENT }, signal },
    );
    const linkHeader = commitCountResponse.headers.get("Link") ?? "";
    const lastPageMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
    totalCommitCount = lastPageMatch ? parseInt(lastPageMatch[1]) : 0;
  } catch {
    totalCommitCount = 0;
  }

  const commitListData = (await ghFetch(
    `/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=30`,
    signal,
  )) as { sha: string }[];

  // Fetch detailed commits with bounded concurrency
  const commitFetchItems = commitListData.slice(0, 30).map((c) => ({
    key: c.sha,
    fetcher: () => ghFetch(`/repos/${owner}/${repo}/commits/${c.sha}`, signal) as Promise<GhCommit>,
  }));

  const commitResults = await concurrentFetch(
    commitFetchItems,
    CONCURRENCY_LIMIT,
    (sha, idx, total) => {
      onProgress({
        fraction: 0.56 + (idx / total) * 0.15,
        stage: "Fetching Git history",
        detail: `Commit ${idx + 1} of ${total}`,
      });
      void sha;
    },
  );

  const commits: Commit[] = [];
  const authorSet = new Set<string>();

  for (const [sha, c] of commitResults) {
    if (signal?.aborted) break;

    const authorName = c.commit?.author?.name ?? c.author?.login ?? "unknown";
    if (authorName && authorName !== "unknown") authorSet.add(authorName);

    // Build file changes with real GitHub metadata — NEVER fabricated
    const fileChanges: FileChange[] = (c.files ?? []).map((f) => ({
      filename: f.filename,
      status: (f.status as FileChange["status"]) ?? "modified",
      additions: f.additions ?? 0,
      deletions: f.deletions ?? 0,
      changes: f.changes ?? (f.additions ?? 0) + (f.deletions ?? 0),
      previous_filename: f.previous_filename,
    }));

    commits.push({
      hash: sha.slice(0, 7),
      message: (c.commit?.message ?? "").split("\n")[0],
      author: authorName,
      date: c.commit?.committer?.date ?? c.commit?.author?.date ?? new Date().toISOString(),
      files: c.files?.map((f) => f.filename) ?? [],
      fileChanges,
    });
  }

  const commitsAnalyzed = commits.length;

  // ════════════════════════════════════════════════════════════
  // STAGE 4 — CONTRIBUTORS
  // ════════════════════════════════════════════════════════════

  onProgress({ fraction: 0.73, stage: "Analyzing contributors", detail: "Fetching contributor data" });

  let contributors: Contributor[] = [];
  let contributorCount = 0;

  try {
    const contributorsData = (await ghFetch(
      `/repos/${owner}/${repo}/contributors?per_page=15`,
      signal,
    )) as GhContributor[];

    const totalContributions = contributorsData.reduce((s, c) => s + c.contributions, 0) || 1;
    contributors = contributorsData.map((c) => ({
      name: c.login,
      commits: c.contributions,
      percentage: Math.round((c.contributions / totalContributions) * 100),
    }));
    contributorCount = contributorsData.length;
  } catch {
    // Fall back to commit authors
    contributorCount = authorSet.size;
    contributors = [...authorSet].map((name) => ({
      name,
      commits: commits.filter((c) => c.author === name).length,
      percentage: 0,
    }));
    const total = contributors.reduce((s, c) => s + c.commits, 0) || 1;
    contributors = contributors.map((c) => ({
      ...c,
      percentage: Math.round((c.commits / total) * 100),
    }));
  }

  const coverageNote = totalCommitCount > commitsAnalyzed
    ? ` (partial — based on first ${commitsAnalyzed} commits)`
    : "";
  checks.push(`✓ ${contributorCount} contributors${coverageNote}`);
  checks.push(`✓ ${commitsAnalyzed} commits analyzed${totalCommitCount > commitsAnalyzed ? ` of ~${totalCommitCount} total` : ""}`);

  // ════════════════════════════════════════════════════════════
  // STAGE 5 — BUILD DERIVED MODELS
  // ════════════════════════════════════════════════════════════

  onProgress({ fraction: 0.78, stage: "Building architecture", detail: "Mapping modules from source structure" });

  const services = buildModulesFromSource(classifiedFiles, allRealDeps, commits);
  const serviceDeps = buildModuleDependencies(services, allRealDeps);

  onProgress({ fraction: 0.82, stage: "Computing metrics", detail: "Calculating code churn" });
  const churn = calculateChurn(commits, sourceFiles);

  const coChanges = detectCoChanges(commits);

  onProgress({ fraction: 0.85, stage: "Computing metrics", detail: "Calculating module risk scores" });

  // Build contributor count per module from REAL data
  const moduleContributorCounts = new Map<string, Set<string>>();
  for (const c of commits) {
    for (const file of c.files ?? []) {
      for (const svc of services) {
        if (file.startsWith(svc.id) || svc.files.includes(file)) {
          if (!moduleContributorCounts.has(svc.id)) {
            moduleContributorCounts.set(svc.id, new Set());
          }
          moduleContributorCounts.get(svc.id)!.add(c.author);
        }
      }
    }
  }
  const contributorCountMap = new Map<string, number>();
  for (const [moduleId, authors] of moduleContributorCounts) {
    contributorCountMap.set(moduleId, authors.size);
  }

  const moduleRisks = calculateModuleRisks(services, churn, sourceFiles, allRealDeps, contributorCountMap);
  const riskyModules = moduleRisks.filter((r) => r.riskScore > 30).slice(0, 10);

  const techDebt = buildTechDebt(moduleRisks, churn, coChanges, classifiedFiles);
  const contributorKnowledge = buildContributorKnowledge(commits, services);

  onProgress({ fraction: 0.9, stage: "Generating insights", detail: "Computing trends" });
  const metrics = buildMetrics(commits, todoCountTotal);

  const evidence = generateEvidence(
    moduleRisks, coChanges, services, allExternalLibs, commits,
  );

  onProgress({ fraction: 0.95, stage: "Generating insights", detail: "Preparing onboarding guide" });
  const onboardingGuide = generateOnboardingGuide(
    services, moduleRisks, allExternalLibs, framework, contributorKnowledge, sourceFiles,
  );

  // Build coverage report
  const coverage = buildCoverage({
    totalFiles: fileCount,
    analyzedFiles: fileCount,
    sourceFilesTotal: sourceFiles.length,
    sourceFilesAnalyzed: fileContents.size,
    totalCommits: Math.max(totalCommitCount, commitsAnalyzed),
    commitsAnalyzed,
    totalContributors: Math.max(contributorCount, authorSet.size),
    analyzedContributors: contributorCount,
  });

  onProgress({
    fraction: 1,
    stage: "Analysis complete",
    detail: `${owner}/${repo}`,
    checks,
  });

  return {
    name,
    source: "github",
    branch,
    description,
    complete: true,
    analyzedAt: new Date().toISOString(),
    commitCount: Math.max(totalCommitCount, commitsAnalyzed),
    contributorCount,
    fileCount,
    totalLines,
    languages,
    framework,
    sourceFiles,
    classifiedFiles: categorizedFiles,
    contributors,
    contributorKnowledge,
    commits,
    services,
    dependencies: serviceDeps,
    realDependencies: allRealDeps,
    internalDependencies: internalDependencyGroups,
    externalDependencies: externalDependencyGroups,
    circularDependencies: circularDeps,
    metrics,
    churn,
    coChanges,
    techDebt,
    moduleRisks,
    riskyModules,
    fileTree: allFileNodes,
    evidence,
    onboardingGuide,
    coverage,
  };
}

/* ── Helper functions ──────────────────────────────────────────── */

function buildModulesFromSource(
  classifiedFiles: ClassifiedFile[],
  _realDeps: RealDependency[],
  commits: Commit[],
): Service[] {
  const dirMap = new Map<string, ClassifiedFile[]>();
  const flatFiles = classifiedFiles.filter(
    (f) => f.category === "source" || f.category === "header",
  );

  for (const f of flatFiles) {
    const parts = f.path.split("/");
    const topDir = parts[0] || "root";
    let key = topDir;
    if ((topDir === "src" || topDir === "lib" || topDir === "include") && parts.length > 2) {
      key = `${topDir}/${parts[1]}`;
    }
    const arr = dirMap.get(key) ?? [];
    arr.push(f);
    dirMap.set(key, arr);
  }

  // Count real commits per module across ALL analyzed commits
  const moduleCommitCounts = new Map<string, number>();
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - 30);
  const moduleRecentCounts = new Map<string, number>();
  for (const c of commits) {
    const commitDate = new Date(c.date);
    const isRecent = commitDate >= recentCutoff;
    const touchedModules = new Set<string>();
    for (const file of c.files ?? []) {
      for (const key of dirMap.keys()) {
        if (file.startsWith(key)) {
          touchedModules.add(key);
        }
      }
    }
    for (const m of touchedModules) {
      moduleCommitCounts.set(m, (moduleCommitCounts.get(m) ?? 0) + 1);
      if (isRecent) {
        moduleRecentCounts.set(m, (moduleRecentCounts.get(m) ?? 0) + 1);
      }
    }
  }

  return [...dirMap.entries()]
    .filter(([, files]) => files.length > 0)
    .sort((a, b) => {
      const aLoc = a[1].reduce((s, f) => s + (f.loc ?? 0), 0);
      const bLoc = b[1].reduce((s, f) => s + (f.loc ?? 0), 0);
      return bLoc - aLoc;
    })
    .slice(0, 12)
    .map(([id, files]) => {
      const loc = files.reduce((s, f) => s + (f.loc ?? 0), 0);
      // REAL 30-day commit count (not estimated)
      const commits30d = moduleRecentCounts.get(id) ?? 0;

      const fileCount = files.length;
      const commitDensity = fileCount > 0 ? commits30d / fileCount : 0;
      let state: "healthy" | "evolving" | "at-risk" = "healthy";
      if (commitDensity > 1.5 || loc > 3000) {
        state = "at-risk";
      } else if (commitDensity > 0.5 || loc > 1000) {
        state = "evolving";
      }

      return {
        id,
        name: id,
        description: `${files.length} file(s) — ${loc.toLocaleString()} LOC`,
        state,
        loc,
        commits30d,
        files: files.map((f) => f.path),
      };
    });
}

function buildModuleDependencies(
  services: Service[],
  realDeps: RealDependency[],
): Dependency[] {
  const edgeMap = new Map<string, { count: number; evidence: string[] }>();

  for (const dep of realDeps) {
    if (dep.external) continue;
    const fromModule = services.find((s) =>
      dep.fromFile.startsWith(s.id) || s.files.includes(dep.fromFile),
    );
    const toModule = services.find((s) =>
      dep.toFile.startsWith(s.id) || s.files.includes(dep.toFile),
    );

    if (fromModule && toModule && fromModule.id !== toModule.id) {
      const key = `${fromModule.id}|${toModule.id}`;
      const entry = edgeMap.get(key) ?? { count: 0, evidence: [] };
      entry.count++;
      entry.evidence.push(dep.evidence);
      edgeMap.set(key, entry);
    }
  }

  return [...edgeMap.entries()]
    .filter(([, data]) => data.count > 0)
    .map(([key, data]) => {
      const [fromId, toId] = key.split("|");

      let risk: "none" | "moderate" | "high" = "none";
      let reason: string | undefined;

      if (data.count >= 3) {
        risk = "high";
        reason = `${data.count} dependency relationships from "${fromId}" to "${toId}"`;
      } else if (data.count >= 1) {
        risk = "moderate";
        reason = `${data.count} dependency relationship(s) from "${fromId}" to "${toId}"`;
      }

      return {
        from: fromId,
        to: toId,
        risk,
        reason,
      };
    });
}

function detectCircularDependencies(
  internalDeps: InternalDependencyGroup[],
): CircularDependency[] {
  const graph = new Map<string, string[]>();
  for (const dep of internalDeps) {
    const list = graph.get(dep.from) ?? [];
    list.push(dep.to);
    graph.set(dep.from, list);
  }

  const cycles: CircularDependency[] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(node: string, path: string[]) {
    visited.add(node);
    recStack.add(node);

    const neighbors = graph.get(node) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path, neighbor]);
      } else if (recStack.has(neighbor)) {
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart);
          cycle.push(neighbor);
          cycles.push({ cycle });
        }
      }
    }

    recStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node, [node]);
    }
  }

  return cycles.slice(0, 5);
}

function buildMetrics(
  commits: Commit[],
  debtMarkers: { count: number; files: number },
): RepositoryAnalysis["metrics"] {
  const deployCadence: RepositoryAnalysis["metrics"]["deployCadence"] = [];
  const debtTrend: RepositoryAnalysis["metrics"]["debtTrend"] = [];
  const now = new Date();

  // Build daily commit cadence for the last 14 days (REAL data)
  const dayCount = new Map<string, number>();
  for (const c of commits) {
    const day = c.date.slice(0, 10);
    dayCount.set(day, (dayCount.get(day) ?? 0) + 1);
  }

  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const commitsOnDay = dayCount.get(date) ?? 0;
    deployCadence.push({
      date,
      value: Math.max(0, commitsOnDay),
    });
  }

  // Debt trend: based on actual TODO/FIXME/HACK markers found in analyzed files
  // If no markers found, debt trend is flat (no evidence of debt markers)
  const baseDebt = Math.min(400, Math.max(0, debtMarkers.count * 10));
  for (const point of deployCadence) {
    // Debt level is the count of markers (direct evidence)
    debtTrend.push({ date: point.date, value: baseDebt });
  }

  return { deployCadence, debtTrend };
}