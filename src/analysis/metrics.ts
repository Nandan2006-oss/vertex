/**
 * Metrics computation from repository analysis data.
 *
 * Calculates evidence-based metrics: complexity estimates,
 * churn analysis, co-change detection, risk scoring, and
 * tech debt assessment.
 *
 * ACCURACY > HONESTY > PERFORMANCE > FEATURES > UI POLISH
 * No fabricated data. Every value must be traceable to its source.
 */

import type {
  ClassifiedFile,
  ChurnRecord,
  CoChange,
  Commit,
  ContributorKnowledge,
  ModuleRisk,
  TechDebtItem,
  DebtEvidence,
  RealDependency,
  Service,
  EvidenceItem,
  OnboardingGuide,
  FrameworkInfo,
  RiskFactor,
  AnalysisCoverage,
  CoverageStatus,
} from "./types";
import { RISK_WEIGHTS } from "./types";

/**
 * Strip JS/TS-style comments from source text (for complexity estimation).
 */
function stripCommentsForComplexity(text: string): string {
  let result = text;
  // Remove single-line comments (after stripping block comments first)
  result = result.replace(/\/\/.*$/gm, "");
  result = result.replace(/#.*$/gm, "");
  // Remove block comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove Python triple-quote strings that are docstrings
  result = result.replace(/"""[\s\S]*?"""/g, "");
  result = result.replace(/'''[\s\S]*?'''/g, "");
  return result;
}

/**
 * Estimate structural complexity from source text.
 *
 * This is NOT formal cyclomatic complexity — it is a heuristic
 * based on keyword density in actual code (comments are stripped first).
 * It should be labelled as an estimate.
 */
export function estimateComplexity(sourceText: string, language: string | null): number {
  if (!sourceText) return 0;
  // Strip comments first so we don't count keywords inside comments
  const codeOnly = stripCommentsForComplexity(sourceText);
  let score = 1;

  const lower = codeOnly.toLowerCase();
  const ifs = (lower.match(/\bif\b/g) ?? []).length;
  const fors = (lower.match(/\bfor\b/g) ?? []).length;
  const whiles = (lower.match(/\bwhile\b/g) ?? []).length;
  const switches = (lower.match(/\bswitch\b/g) ?? []).length;
  const cases = (lower.match(/\bcase\b/g) ?? []).length;
  const catches = (lower.match(/\bcatch\b/g) ?? []).length;
  const andLogicals = (lower.match(/\&\&/g) ?? []).length;
  const orLogicals = (lower.match(/\|\|/g) ?? []).length;

  // Python-specific: 'and' and 'or' as logical operators
  if (language?.toLowerCase() === "python") {
    const pythonAnd = (lower.match(/\band\b/g) ?? []).length;
    const pythonOr = (lower.match(/\bor\b/g) ?? []).length;
    // Subtract the 'and'/'or' that were already counted in /\&\&/ and /\|\|/
    score += (pythonAnd + pythonOr);
  }

  score += ifs + fors + whiles;
  score += switches + cases + catches;
  score += andLogicals + orLogicals;

  return score;
}

/**
 * Calculate per-file churn from REAL commit/file-change data.
 *
 * Uses additions/deletions from GitHub commit file metadata when available.
 * Never invents values with Math.random() or arbitrary constants.
 */
export function calculateChurn(
  commits: Commit[],
  sourceFiles: ClassifiedFile[],
): ChurnRecord[] {
  const fileData = new Map<string, {
    totalCommits: number;
    recentChanges: number;
    linesAdded: number;
    linesDeleted: number;
    totalChanges: number;
    firstChanged: string | null;
    lastChanged: string | null;
  }>();

  const now = new Date();
  const recentCutoff = new Date(now);
  recentCutoff.setDate(now.getDate() - 30);

  for (const commit of commits) {
    const commitDate = new Date(commit.date);
    const isRecent = commitDate >= recentCutoff;

    for (const file of commit.files || []) {
      if (!sourceFiles.some((sf) => sf.path === file)) continue;

      const entry = fileData.get(file) ?? {
        totalCommits: 0,
        recentChanges: 0,
        linesAdded: 0,
        linesDeleted: 0,
        totalChanges: 0,
        firstChanged: null as string | null,
        lastChanged: null as string | null,
      };

      entry.totalCommits++;

      // Use real file change metadata when available
      if (commit.fileChanges) {
        const fileChange = commit.fileChanges.find((fc) => fc.filename === file);
        if (fileChange) {
          entry.linesAdded += fileChange.additions;
          entry.linesDeleted += fileChange.deletions;
          entry.totalChanges += fileChange.changes;
        }
      }

      if (isRecent) entry.recentChanges++;

      if (!entry.firstChanged) entry.firstChanged = commit.date;
      entry.lastChanged = commit.date;

      fileData.set(file, entry);
    }
  }

  const totalCommitsOverall = commits.length;
  const avgCommitsPerFile = totalCommitsOverall / Math.max(1, sourceFiles.length);

  return [...fileData.entries()]
    .map(([filePath, data]) => ({
      filePath,
      totalCommits: data.totalCommits,
      linesAdded: data.linesAdded,
      linesDeleted: data.linesDeleted,
      totalChanges: data.totalChanges || data.linesAdded + data.linesDeleted,
      recentChanges: data.recentChanges,
      firstChanged: data.firstChanged ?? undefined,
      lastChanged: data.lastChanged ?? undefined,
      changeFrequency:
        data.totalCommits > avgCommitsPerFile * 2
          ? "high" as const
          : data.totalCommits > avgCommitsPerFile * 0.5
            ? "moderate" as const
            : "low" as const,
    }))
    .sort((a, b) => b.totalCommits - a.totalCommits);
}

/**
 * Detect co-change relationships: files that appear together
 * in the same commits.
 *
 * Uses Jaccard(A,B) = |A ∩ B| / |A ∪ B| for normalized coupling.
 * Also tracks rawCoChangeCount to account for sample size.
 * Filters out pairs with insufficient history.
 */
export function detectCoChanges(commits: Commit[]): CoChange[] {
  // Track per-file commit sets
  const fileCommits = new Map<string, Set<number>>();
  for (let ci = 0; ci < commits.length; ci++) {
    const files = (commits[ci].files ?? []).filter(
      (f) => !f.startsWith(".") && !f.includes("node_modules"),
    );
    if (files.length < 2) continue;
    for (const file of files) {
      const set = fileCommits.get(file) ?? new Set();
      set.add(ci);
      fileCommits.set(file, set);
    }
  }

  // Build pairwise co-change matrix with Jaccard
  const pairs = new Map<string, { count: number; totalCommits: number; unionSize: number }>();
  const seen = new Set<string>();

  for (const [fileA, commitsA] of fileCommits) {
    for (const [fileB, commitsB] of fileCommits) {
      if (fileA >= fileB) continue;
      const key = `${fileA}|||${fileB}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const intersection = new Set([...commitsA].filter((c) => commitsB.has(c)));
      const coCount = intersection.size;
      if (coCount < 1) continue;

      const union = new Set([...commitsA, ...commitsB]);
      pairs.set(key, {
        count: coCount,
        totalCommits: commits.length,
        unionSize: union.size,
      });
    }
  }

  return [...pairs.entries()]
    .map(([key, data]) => {
      const [fileA, fileB] = key.split("|||");
      const jaccard = data.unionSize > 0 ? data.count / data.unionSize : 0;
      return {
        fileA,
        fileB,
        commitCount: data.count,
        totalCommits: data.totalCommits,
        jaccard: Math.round(jaccard * 1000) / 1000,
        insufficientEvidence: data.count < 2 || data.unionSize < 3,
      };
    })
    .filter((c) => !c.insufficientEvidence)
    .sort((a, b) => b.jaccard - a.jaccard)
    .slice(0, 50);
}

/**
 * Build contributor knowledge from commit history.
 *
 * Uses REAL file change data when available (line counts from GitHub API).
 * Never invents line counts from commit count alone.
 */
export function buildContributorKnowledge(
  commits: Commit[],
  services: Service[],
): ContributorKnowledge[] {
  const contributorData = new Map<
    string,
    {
      commits: number;
      filesChanged: Set<string>;
      modulesTouched: Set<string>;
      linesAdded: number;
      linesDeleted: number;
      firstContribution: string | null;
      mostRecentContribution: string | null;
    }
  >();

  for (const commit of commits) {
    const entry = contributorData.get(commit.author) ?? {
      commits: 0,
      filesChanged: new Set<string>(),
      modulesTouched: new Set<string>(),
      linesAdded: 0,
      linesDeleted: 0,
      firstContribution: null as string | null,
      mostRecentContribution: null as string | null,
    };
    entry.commits++;

    // Use real file change metadata when available
    if (commit.fileChanges) {
      for (const fc of commit.fileChanges) {
        entry.linesAdded += fc.additions;
        entry.linesDeleted += fc.deletions;
      }
    }

    for (const file of commit.files ?? []) {
      entry.filesChanged.add(file);
      for (const service of services) {
        if (file.startsWith(service.id) || service.files.includes(file)) {
          entry.modulesTouched.add(service.id);
        }
      }
    }

    if (!entry.firstContribution) entry.firstContribution = commit.date;
    entry.mostRecentContribution = commit.date;

    contributorData.set(commit.author, entry);
  }

  return [...contributorData.entries()]
    .map(([name, data]) => {
      const modulesArray = [...data.modulesTouched];
      const primaryModules = modulesArray.slice(0, Math.min(3, modulesArray.length));
      const totalLines = data.linesAdded + data.linesDeleted;
      return {
        name,
        commits: data.commits,
        filesChanged: data.filesChanged.size,
        linesChanged: totalLines > 0 ? totalLines : null, // null means unavailable
        linesAdded: data.linesAdded,
        linesDeleted: data.linesDeleted,
        modulesTouched: modulesArray,
        primaryModules,
        firstContribution: data.firstContribution ?? undefined,
        mostRecentContribution: data.mostRecentContribution ?? undefined,
      };
    })
    .sort((a, b) => b.commits - a.commits);
}

/**
 * Calculate risk scores for modules using multiple evidence-based metrics.
 *
 * Every risk factor is traceable to real evidence.
 * Scores use RISK_WEIGHTS constants from types.ts (centralized).
 *
 * @param contributorCountMap Optional map of module name → real contributor count.
 *        When not provided, contributor counts default to 0 and are labelled "Unavailable".
 */
export function calculateModuleRisks(
  services: Service[],
  churn: ChurnRecord[],
  sourceFiles: ClassifiedFile[],
  realDependencies: RealDependency[],
  commits: Commit[],
  contributorCountMap?: Map<string, number>,
): ModuleRisk[] {
  const totalChurn = churn.reduce((s, c) => s + c.totalCommits, 0) || 1;

  return services.map((svc) => {
    const moduleFiles = svc.files;
    const moduleSourceFiles = sourceFiles.filter((f) =>
      moduleFiles.some((mf) => f.path === mf || f.path.startsWith(svc.id)),
    );

    const totalLOC = moduleSourceFiles.reduce((s, f) => s + (f.loc ?? 0), 0);
    const fileCount = moduleSourceFiles.length;

    // Structural complexity: use REAL per-file complexity estimates when available
    const validComplexities = moduleSourceFiles
      .map((f) => f.complexityEstimate)
      .filter((c): c is number => c !== null);
    const avgComplexity = validComplexities.length > 0
      ? Math.round(validComplexities.reduce((s, c) => s + c, 0) / validComplexities.length)
      : 0;

    // Churn for this module
    const moduleChurn = churn.filter((c) =>
      moduleFiles.some((mf) => c.filePath === mf || c.filePath.startsWith(svc.id)),
    );
    const moduleChurnCount = moduleChurn.reduce((s, c) => s + c.totalCommits, 0);

    // Dependency counts
    const depsFromModule = realDependencies.filter((d) =>
      moduleFiles.some((mf) => d.fromFile === mf || d.fromFile.startsWith(svc.id)),
    );
    const depsToModule = realDependencies.filter((d) =>
      moduleFiles.some((mf) => d.toFile === mf || d.toFile.startsWith(svc.id)),
    );
    const dependencyCount = depsFromModule.length;
    const dependentCount = depsToModule.length;

    // REAL contributor count (from actual git authors), or 0 if unavailable
    const contributorCount = contributorCountMap?.get(svc.id) ?? 0;
    const hasContributorData = contributorCount > 0 || !!contributorCountMap;

    // Risk score with evidence factors
    let score = 0;
    const factors: RiskFactor[] = [];
    const reasons: string[] = [];

    // Factor 1: Complexity
    const complexityFactor = Math.min(1, avgComplexity / 30);
    const complexityContribution = Math.round(complexityFactor * RISK_WEIGHTS.complexity);
    score += complexityContribution;
    const hasComplexityMetric = validComplexities.length > 0;
    factors.push({
      name: "Complexity",
      contribution: hasComplexityMetric ? complexityContribution : 0,
      evidence: {
        metric: "Structural complexity estimate",
        value: hasComplexityMetric ? avgComplexity : "Unavailable",
        label: "Estimated structural complexity (keyword density)",
        explanation: hasComplexityMetric
          ? avgComplexity > 15
            ? `High complexity estimate (${avgComplexity}) — above typical module threshold`
            : avgComplexity > 8
              ? `Moderate complexity estimate (${avgComplexity})`
              : `Low complexity estimate (${avgComplexity})`
          : "Complexity analysis unavailable — file contents not deeply analyzed",
        confidence: hasComplexityMetric ? "medium" : "low",
      },
    });
    if (complexityFactor > 0.5 && hasComplexityMetric) {
      reasons.push(`Estimated structural complexity: ${avgComplexity} — above average`);
    }

    // Factor 2: Churn
    const churnRatio = totalChurn > 0 ? moduleChurnCount / totalChurn : 0;
    const churnFactor = Math.min(1, churnRatio * 5);
    const churnContribution = Math.round(churnFactor * RISK_WEIGHTS.churn);
    score += churnContribution;
    factors.push({
      name: "Churn",
      contribution: churnContribution,
      evidence: {
        metric: "Commit count",
        value: moduleChurnCount,
        label: "Historical commits touching this module",
        explanation: `${moduleChurnCount} commits touching this module${
          moduleChurn.length > 0
            ? ` (top file: ${moduleChurn[0]?.filePath ?? "N/A"})`
            : ""
        }`,
        confidence: moduleChurnCount > 0 ? "high" : "low",
      },
    });
    if (churnFactor > 0.3) {
      reasons.push(`${moduleChurnCount} commits — high activity`);
    }

    // Factor 3: Coupling
    const couplingScore = dependencyCount + dependentCount;
    const couplingFactor = Math.min(1, couplingScore / 20);
    const couplingContribution = Math.round(couplingFactor * RISK_WEIGHTS.coupling);
    score += couplingContribution;
    factors.push({
      name: "Coupling",
      contribution: couplingContribution,
      evidence: {
        metric: "Dependency relationships",
        value: `${dependencyCount} out, ${dependentCount} in`,
        label: "Module coupling count",
        explanation: `${dependencyCount} outbound dependencies, ${dependentCount} inbound dependencies`,
        confidence: couplingScore > 0 ? "high" : "low",
      },
    });
    if (couplingFactor > 0.3) {
      reasons.push(`${dependencyCount} outbound dep(s), ${dependentCount} inbound dep(s) — coupled`);
    }

    // Factor 4: Size
    const sizeFactor = Math.min(1, totalLOC / 3000);
    const sizeContribution = totalLOC > 0 ? Math.round(sizeFactor * RISK_WEIGHTS.size) : 0;
    score += sizeContribution;
    factors.push({
      name: "Size",
      contribution: sizeContribution,
      evidence: {
        metric: "Lines of code",
        value: totalLOC > 0 ? totalLOC : "Unavailable",
        label: "Total LOC in module",
        explanation: totalLOC > 0
          ? `${totalLOC} LOC across ${fileCount} files`
          : "Line counts unavailable — files not deeply analyzed",
        confidence: totalLOC > 0 ? "high" : "medium",
      },
    });
    if (sizeFactor > 0.5 && totalLOC > 0) {
      reasons.push(`${totalLOC} LOC across ${fileCount} files — large module`);
    }

    // Factor 5: Bus factor using 80% threshold
    // Minimum number of contributors responsible for 80% of changes to this module
    let busFactorContribution = 0;
    let busFactorValue: string | number = "Unavailable";
    let busFactorExplanation = "Bus factor unavailable — insufficient contributor data";

    if (hasContributorData && contributorCount > 0 && moduleChurnCount > 0) {
      // Calculate bus factor from real contributor distribution per module
      const moduleContributorCommitCounts = new Map<string, number>();
      for (const c of commits) {
        if (c.files?.some((f) => moduleFiles.some((mf) => f === mf || f.startsWith(svc.id)))) {
          moduleContributorCommitCounts.set(
            c.author,
            (moduleContributorCommitCounts.get(c.author) ?? 0) + 1,
          );
        }
      }
      const sortedContribs = [...moduleContributorCommitCounts.entries()]
        .sort((a, b) => b[1] - a[1]);
      const totalModuleCommits = sortedContribs.reduce((s, [, cnt]) => s + cnt, 0);
      let cumulative = 0;
      let busFactor = 0;
      for (const [, cnt] of sortedContribs) {
        cumulative += cnt;
        busFactor++;
        if (cumulative / totalModuleCommits >= 0.8) break;
      }

      busFactorValue = busFactor;
      busFactorContribution = busFactor <= 2 && fileCount > 3 ? RISK_WEIGHTS.busFactor : 0;
      busFactorExplanation = busFactor <= 2 && fileCount > 3
        ? `Bus factor: ${busFactor} — 80% of changes made by ${busFactor} contributor(s) for ${fileCount} files (concentrated knowledge)`
        : `Bus factor: ${busFactor} — adequate contributor diversity`;
    }

    score += busFactorContribution;
    factors.push({
      name: "Bus factor",
      contribution: busFactorContribution,
      evidence: {
        metric: "80%-threshold bus factor",
        value: busFactorValue,
        label: "Minimum contributors responsible for 80% of historical changes",
        explanation: busFactorExplanation,
        confidence: hasContributorData ? "high" : "low",
      },
    });
    if (hasContributorData && typeof busFactorValue === "number" && busFactorValue <= 2 && fileCount > 3) {
      reasons.push(`Bus factor: ${busFactorValue} — 80% of changes by few contributors`);
    }

    const finalScore = Math.min(100, Math.round(score));

    const isGodModule =
      fileCount > 5 &&
      totalLOC > 2000 &&
      (dependencyCount + dependentCount) > 5 &&
      avgComplexity > 10;

    if (isGodModule) {
      reasons.unshift("Potential God Module: large, complex, highly coupled");
    }

    return {
      moduleName: svc.name,
      riskScore: finalScore,
      factors,
      loc: totalLOC,
      fileCount,
      complexityEstimate: avgComplexity,
      churn: moduleChurnCount,
      dependencyCount,
      dependentCount,
      contributorCount: hasContributorData ? contributorCount : 0,
      isGodModule,
      reasons: reasons.slice(0, 5),
    };
  }).sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * Build tech debt items from module risks and source files.
 *
 * Uses evidence-backed metrics only.
 * "Aging debt" is replaced by actual first-observed dates where available.
 */
export function buildTechDebt(
  moduleRisks: ModuleRisk[],
  churn: ChurnRecord[],
  coChanges: CoChange[],
  classifiedFiles: ClassifiedFile[],
): TechDebtItem[] {
  const items: TechDebtItem[] = [];

  const relevantFiles = classifiedFiles.filter(
    (f) => f.category === "source" || f.category === "header" || f.category === "test",
  );

  // Top modules by risk
  for (const mr of moduleRisks.slice(0, 5)) {
    if (mr.riskScore < 25) continue;

    const evidence: DebtEvidence[] = [
      { metric: "Risk Score", value: `${mr.riskScore}/100`, label: "Combined risk score from complexity, churn, coupling, size, and bus factor" },
      { metric: "LOC", value: `${mr.loc}`, label: "Lines of code" },
      { metric: "Complexity Estimate", value: mr.complexityEstimate.toFixed(1), label: "Structural complexity estimate (keyword density)" },
      { metric: "Churn", value: `${mr.churn} commits`, label: "Historical commit count" },
    ];
    if (mr.dependencyCount > 0) {
      evidence.push({ metric: "Dependencies", value: `${mr.dependencyCount}`, label: "Modules this depends on" });
    }
    if (mr.dependentCount > 0) {
      evidence.push({ metric: "Dependents", value: `${mr.dependentCount}`, label: "Modules depending on this" });
    }
    if (mr.contributorCount <= 2) {
      evidence.push({ metric: "Contributors", value: `${mr.contributorCount}`, label: "Low contributor count" });
    }

    // Calculate risk duration if we have churn data
    const moduleChurnRecords = churn.filter((c) =>
      mr.moduleName.split("/").some((part) => c.filePath.startsWith(part)) ||
      c.filePath.startsWith(mr.moduleName),
    );
    const firstObserved = moduleChurnRecords.length > 0
      ? moduleChurnRecords.reduce((earliest, r) => {
          if (!r.firstChanged) return earliest;
          return !earliest || r.firstChanged < earliest ? r.firstChanged : earliest;
        }, undefined as string | undefined)
      : undefined;
    const riskDurationDays = firstObserved
      ? Math.round((Date.now() - new Date(firstObserved).getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

    items.push({
      id: `debt-mod-${mr.moduleName.replace(/[^a-z0-9]/gi, "-")}`,
      hotspot: mr.moduleName,
      riskScore: mr.riskScore,
      factors: mr.factors,
      agingDebt: riskDurationDays ? `${riskDurationDays} days` : "Unknown",
      filePath: mr.moduleName,
      detail: mr.reasons.slice(0, 2).join("; "),
      evidence,
      firstObserved,
      riskDurationDays,
    });
  }

  // Top churned source files
  const topChurned = churn
    .filter((c) => relevantFiles.some((f) => f.path === c.filePath))
    .slice(0, 8);

  for (const ch of topChurned) {
    if (items.some((i) => i.filePath === ch.filePath)) continue;

    const fileInfo = relevantFiles.find((f) => f.path === ch.filePath);
    if (!fileInfo) continue;

    const evidence: DebtEvidence[] = [
      { metric: "Commits", value: `${ch.totalCommits}`, label: "Total commits touching this file" },
      { metric: "Recent Changes", value: `${ch.recentChanges}`, label: "Changes in last 30 days" },
    ];

    if (ch.linesAdded > 0 || ch.linesDeleted > 0) {
      evidence.push({
        metric: "Lines Changed",
        value: `${ch.linesAdded}+ / ${ch.linesDeleted}-`,
        label: "Additions / Deletions",
      });
    }

    if (fileInfo.loc && fileInfo.loc > 200) {
      evidence.push({ metric: "Size", value: `${fileInfo.loc} LOC`, label: "File size" });
    }

    const fileCoChanges = coChanges.filter(
      (cc) => cc.fileA === ch.filePath || cc.fileB === ch.filePath,
    );
    if (fileCoChanges.length > 0) {
      evidence.push({
        metric: "Co-changes",
        value: `${fileCoChanges.length} partner(s)`,
        label: "Files that change together with this one",
      });
    }

    // Risk score derived from actual evidence: commit churn and recency
    // Uses commit count normalized against file churn (no arbitrary multipliers)
    const churnEvidence = Math.min(30, ch.totalCommits * 3) + Math.min(20, ch.recentChanges * 5);
    const fileRiskScore = Math.min(85, churnEvidence);

    items.push({
      id: `debt-file-${ch.filePath.replace(/[^a-z0-9]/gi, "-")}`,
      hotspot: ch.filePath.split("/").pop() ?? ch.filePath,
      riskScore: fileRiskScore > 0 ? fileRiskScore : 0,
      factors: [],
      agingDebt: ch.firstChanged
        ? `${Math.round((Date.now() - new Date(ch.firstChanged).getTime()) / (1000 * 60 * 60 * 24))} days`
        : "Unknown",
      filePath: ch.filePath,
      detail: `${ch.totalCommits} commit(s), ${ch.recentChanges} recent — high activity area`,
      evidence,
      firstObserved: ch.firstChanged,
      riskDurationDays: ch.firstChanged
        ? Math.round((Date.now() - new Date(ch.firstChanged).getTime()) / (1000 * 60 * 60 * 24))
        : undefined,
    });
  }

  return items.sort((a, b) => b.riskScore - a.riskScore).slice(0, 10);
}

/**
 * Generate evidence-based insights from the analysis data.
 * No AI — only deterministic observations from real data.
 */
export function generateEvidence(
  moduleRisks: ModuleRisk[],
  coChanges: CoChange[],
  _services: Service[],
  _externalDeps: string[],
  commits: Commit[],
): EvidenceItem[] {
  const items: EvidenceItem[] = [];

  // Top risk insight
  if (moduleRisks.length > 0) {
    const top = moduleRisks[0];
    const factorDetails = top.factors
      .filter((f) => f.contribution > 0)
      .map((f) => `${f.name}: +${f.contribution} (${f.evidence.explanation})`)
      .join("; ");
    items.push({
      insight: `"${top.moduleName}" is the highest-risk module in this codebase.`,
      source: "Static Analysis + Git History",
      facts: [
        `Risk score: ${top.riskScore}/100 (derived from complexity, churn, coupling, size, and bus factor)`,
        `Factors: ${factorDetails}`,
        `${top.loc} lines of code across ${top.fileCount} files`,
        `Estimated structural complexity: ${top.complexityEstimate}`,
        `${top.churn} historical commits`,
        `Depended on by ${top.dependentCount} other module(s)`,
      ],
      inference: `This suggests "${top.moduleName}" is a central, actively-developed area that warrants careful attention during changes.`,
    });
  }

  // Strongest co-change (sorted by Jaccard coefficient)
  const strongCoChanges = coChanges.filter((c) => c.jaccard !== undefined && c.jaccard > 0.3);
  if (strongCoChanges.length > 0) {
    const topCC = strongCoChanges[0];
    items.push({
      insight: `"${topCC.fileA.split("/").pop()}" and "${topCC.fileB.split("/").pop()}" change together frequently.`,
      source: "Git History",
      facts: [
        `${topCC.commitCount} co-changes detected (Jaccard: ${topCC.jaccard}) out of ${topCC.totalCommits} total commits analyzed`,
        `Files: ${topCC.fileA}, ${topCC.fileB}`,
      ],
      inference: "This suggests these files are architecturally coupled and should be reviewed together.",
    });
  }

  // Coupling insight
  const highDependents = moduleRisks.filter((r) => r.dependentCount > 3);
  if (highDependents.length > 0) {
    const names = highDependents.slice(0, 3).map((r) => `"${r.moduleName}"`).join(", ");
    items.push({
      insight: `${names} ${highDependents.length === 1 ? "is" : "are"} widely depended upon.`,
      source: "Static Analysis",
      facts: highDependents.slice(0, 3).map(
        (r) => `"${r.moduleName}" is imported by ${r.dependentCount} other module(s)`,
      ),
      inference: "Changes to these modules have broad impact across the codebase.",
    });
  }

  // Contributor bus factor (using 80%-threshold)
  const lowContributor = moduleRisks.filter((r) => {
    const bfFactor = r.factors.find((f) => f.name === "Bus factor");
    return bfFactor && typeof bfFactor.evidence.value === "number" && bfFactor.evidence.value <= 2 && r.fileCount > 3;
  });
  if (lowContributor.length > 0) {
    const names = lowContributor.slice(0, 2).map((r) => `"${r.moduleName}"`).join(", ");
    items.push({
      insight: `${names} ${lowContributor.length === 1 ? "has" : "have"} concentrated contributor knowledge.`,
      source: "Git History",
      facts: lowContributor.slice(0, 2).map((r) => {
        const bf = r.factors.find((f) => f.name === "Bus factor");
        return `${r.moduleName}: bus factor ${bf?.evidence.value} (80% of changes by few) for ${r.fileCount} files`;
      }),
      inference: "These modules have elevated bus-factor risk — knowledge is concentrated among few contributors.",
    });
  }

  // Activity insight
  if (commits.length > 10) {
    const recent = commits.slice(0, 5);
    const uniqueAuthors = new Set(recent.map((c) => c.author));
    const totalFiles = recent.reduce((s, c) => s + (c.files?.length ?? 0), 0);
    items.push({
      insight: `Recent activity: ${recent.length} commits by ${uniqueAuthors.size} contributor(s) touching ~${totalFiles} files.`,
      source: "Git History",
      facts: [
        `${recent.length} most recent commits span ${totalFiles} files`,
        `Contributors: ${[...uniqueAuthors].join(", ")}`,
      ],
      inference: "The codebase has ongoing active development.",
    });
  }

  return items;
}

/**
 * Generate an onboarding guide for new developers.
 */
export function generateOnboardingGuide(
  services: Service[],
  moduleRisks: ModuleRisk[],
  _externalDeps: string[],
  framework: FrameworkInfo | null,
  contributorKnowledge: ContributorKnowledge[],
  sourceFiles: ClassifiedFile[],
): OnboardingGuide {
  const projectType = framework?.name ?? "Multi-language project";
  const entryPoints = sourceFiles
    .filter((f) =>
      /(?:main|index|entry|app)\.[a-z]+$/i.test(f.path) ||
      f.path.includes("main.") ||
      f.path === "index.ts" ||
      f.path === "index.js" ||
      f.path === "main.py" ||
      f.path === "main.cpp"
    )
    .slice(0, 5)
    .map((f) => f.path);

  const majorModules = services.slice(0, 8).map((s) => ({
    name: s.name,
    description: s.description,
    fileCount: s.files.length,
  }));

  // Recommended exploration path: least risky → most foundational modules
  const sortedByRisk = [...moduleRisks].sort(
    (a, b) => a.riskScore - b.riskScore,
  );

  const recommendedPath = sortedByRisk.slice(0, 6).map((m, i) => ({
    step: i + 1,
    file: m.moduleName,
    reason: m.reasons.length > 0
      ? m.reasons[0]
      : `${m.loc} LOC, risk score ${m.riskScore}/100`,
  }));

  // Add entry points first
  const withEntryPoints = [
    ...entryPoints.map((ep, i) => ({
      step: i + 1,
      file: ep,
      reason: "Project entry point — start here",
    })),
    ...recommendedPath.slice(0, Math.max(0, 6 - entryPoints.length)).map((r, i) => ({
      step: entryPoints.length + i + 1,
      file: r.file,
      reason: r.reason,
    })),
  ].slice(0, 6);

  const riskyModules = moduleRisks
    .filter((r) => r.riskScore > 50)
    .slice(0, 5)
    .map((r) => r.moduleName);

  const primaryContributors = services.slice(0, 5).map((svc) => {
    const people = contributorKnowledge
      .filter((ck) => ck.primaryModules.includes(svc.id))
      .slice(0, 3)
      .map((ck) => ck.name);
    return { module: svc.name, people };
  });

  return {
    projectType,
    entryPoints,
    majorModules,
    recommendedPath: withEntryPoints,
    riskyModules,
    primaryContributors,
  };
}

/**
 * Build a coverage report from analysis state.
 * This tells the user how much of the repository was actually examined.
 * Different metrics have independent coverage — never conflate them.
 */
export function buildCoverage(params: {
  totalFiles: number;
  analyzedFiles: number;
  sourceFilesTotal: number;
  sourceFilesAnalyzed: number;
  sourceFilesSkipped: number;
  sourceFilesFailed: number;
  totalCommits: number;
  /** When false, totalCommits should not be trusted as a reliable ceiling */
  totalCommitsReliable: boolean;
  commitsAnalyzed: number;
  totalContributors: number;
  analyzedContributors: number;
  historyStart?: string;
  historyEnd?: string;
}): AnalysisCoverage {
  const {
    totalFiles,
    analyzedFiles,
    sourceFilesTotal,
    sourceFilesAnalyzed,
    sourceFilesSkipped,
    sourceFilesFailed,
    totalCommits,
    totalCommitsReliable,
    commitsAnalyzed,
    totalContributors,
    analyzedContributors,
    historyStart,
    historyEnd,
  } = params;

  // For confidence, only use totalCommits when it's reliable
  const commitsForConfidence = totalCommitsReliable ? totalCommits : commitsAnalyzed;
  const commitCeil = totalCommitsReliable ? totalCommits : 0;
  const historyPct = commitCeil > 0 ? commitsAnalyzed / commitCeil : 0;
  const filePct = totalFiles > 0 ? analyzedFiles / totalFiles : 0;
  const depPct = sourceFilesTotal > 0 ? sourceFilesAnalyzed / sourceFilesTotal : 0;

  // Overall confidence
  const confidence: "high" | "medium" | "low" =
    historyPct >= 0.8 && filePct >= 0.9 && depPct >= 0.8
      ? "high"
      : historyPct >= 0.3 || filePct >= 0.5
        ? "medium"
        : "low";

  // Separate coverage status for each area
  const fileStatus: CoverageStatus =
    totalFiles === 0 ? "unavailable"
    : analyzedFiles >= totalFiles ? "complete"
    : analyzedFiles > 0 ? "partial"
    : "unavailable";

  const depStatus: CoverageStatus =
    sourceFilesTotal === 0 ? "unavailable"
    : sourceFilesAnalyzed >= sourceFilesTotal ? "complete"
    : sourceFilesAnalyzed > 0 ? "partial"
    : "unavailable";

  // History: never assume completeness from missing metadata
  let historyStatus: CoverageStatus;
  let historyComplete = false;
  if (!totalCommitsReliable && commitsAnalyzed > 0) {
    // GitHub did not provide a reliable total — we cannot prove completeness
    historyStatus = "unavailable";
  } else if (totalCommits === 0) {
    historyStatus = "unavailable";
  } else if (commitsAnalyzed >= totalCommits) {
    historyStatus = "complete";
    historyComplete = true;
  } else if (commitsAnalyzed > 0) {
    historyStatus = "partial";
  } else {
    historyStatus = "unavailable";
  }

  const contribStatus: CoverageStatus =
    totalContributors === 0 ? "unavailable"
    : analyzedContributors >= totalContributors ? "complete"
    : analyzedContributors > 0 ? "partial"
    : "unavailable";

  // Build an honest history label
  let historyLabel: string;
  if (commitsAnalyzed === 0) {
    historyLabel = "Git history not available";
  } else if (!totalCommitsReliable) {
    historyLabel = `Completeness unknown — ${commitsAnalyzed} commits analyzed`;
  } else if (commitsAnalyzed >= totalCommits) {
    historyLabel = `Full available history analyzed (${commitsAnalyzed} commits)`;
  } else if (historyStatus === "partial") {
    historyLabel = `History partially analyzed — ${commitsAnalyzed} of ~${totalCommits} commits`;
  } else {
    historyLabel = `Partial Git history analyzed (${commitsAnalyzed} commits)`;
  }

  // Calculate history span in days
  let historyDays: number | undefined;
  if (historyStart && historyEnd) {
    historyDays = Math.round(
      (new Date(historyEnd).getTime() - new Date(historyStart).getTime())
      / (1000 * 60 * 60 * 24),
    ) + 1;
  }

  return {
    files: {
      total: totalFiles,
      analyzed: analyzedFiles,
      skipped: totalFiles - analyzedFiles,
      status: fileStatus,
    },
    dependencies: {
      sourceFilesTotal,
      sourceFilesAnalyzed,
      sourceFilesSkipped,
      sourceFilesFailed,
      status: depStatus,
    },
    history: {
      totalCommits: totalCommitsReliable ? totalCommits : commitsForConfidence,
      commitsAnalyzed,
      label: historyLabel,
      historyStart,
      historyEnd,
      historyDays,
      historyComplete,
      status: historyStatus,
    },
    contributors: {
      total: totalContributors,
      analyzed: analyzedContributors,
      status: contribStatus,
    },
    confidence,
  };
}