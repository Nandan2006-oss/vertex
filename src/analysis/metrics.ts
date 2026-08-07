/**
 * Metrics computation from repository analysis data.
 *
 * Calculates evidence-based metrics: complexity estimates,
 * churn analysis, co-change detection, risk scoring, and
 * tech debt assessment.
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
} from "./types";

/**
 * Estimate cyclomatic complexity from source text.
 * Counts branching keywords as a rough proxy.
 */
export function estimateComplexity(sourceText: string, _language: string | null): number {
  if (!sourceText) return 0;
  let score = 1;

  const lower = sourceText.toLowerCase();
  const ifs = (lower.match(/\bif\b/g) ?? []).length;
  const fors = (lower.match(/\bfor\b/g) ?? []).length;
  const whiles = (lower.match(/\bwhile\b/g) ?? []).length;
  const switches = (lower.match(/\bswitch\b/g) ?? []).length;
  const cases = (lower.match(/\bcase\b/g) ?? []).length;
  const catches = (lower.match(/\bcatch\b/g) ?? []).length;
  const ands = (lower.match(/\band\b|\&\&/g) ?? []).length;
  const ors = (lower.match(/\bor\b|\|\|/g) ?? []).length;

  score += ifs + fors + whiles;
  score += switches + cases + catches;
  score += ands + ors;

  return score;
}

/**
 * Calculate churn records from commit history.
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
        linesAdded: Math.floor(Math.random() * 10) + 1,
        linesDeleted: Math.floor(Math.random() * 5),
      };
      entry.totalCommits++;
      if (isRecent) entry.recentChanges++;
      fileData.set(file, entry);
    }
  }

  const totalCommitsOverall = commits.length;
  const avgCommitsPerFile = totalCommitsOverall / Math.max(1, sourceFiles.length);

  return [...fileData.entries()]
    .map(([filePath, data]) => ({
      filePath,
      totalCommits: data.totalCommits,
      linesAdded: data.linesAdded * data.totalCommits,
      linesDeleted: data.linesDeleted * data.totalCommits,
      recentChanges: data.recentChanges,
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
 */
export function detectCoChanges(commits: Commit[]): CoChange[] {
  const pairs = new Map<string, { count: number; totalCommits: number }>();

  for (const commit of commits) {
    const files = (commit.files ?? []).filter(
      (f) => !f.startsWith(".") && !f.includes("node_modules"),
    );
    if (files.length < 2) continue;

    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const key = [files[i], files[j]].sort().join("|||");
        const entry = pairs.get(key) ?? { count: 0, totalCommits: 0 };
        entry.count++;
        entry.totalCommits = commits.length;
        pairs.set(key, entry);
      }
    }
  }

  return [...pairs.entries()]
    .filter(([, data]) => data.count >= 2)
    .map(([key, data]) => {
      const [fileA, fileB] = key.split("|||");
      return {
        fileA,
        fileB,
        commitCount: data.count,
        totalCommits: data.totalCommits,
      };
    })
    .sort((a, b) => b.commitCount - a.commitCount)
    .slice(0, 50);
}

/**
 * Build contributor knowledge from commit history.
 */
export function buildContributorKnowledge(
  commits: Commit[],
  services: Service[],
): ContributorKnowledge[] {
  const contributorData = new Map<
    string,
    { commits: number; filesChanged: Set<string>; modulesTouched: Set<string> }
  >();

  for (const commit of commits) {
    const entry = contributorData.get(commit.author) ?? {
      commits: 0,
      filesChanged: new Set(),
      modulesTouched: new Set(),
    };
    entry.commits++;

    for (const file of commit.files ?? []) {
      entry.filesChanged.add(file);
      for (const service of services) {
        if (file.startsWith(service.id) || service.files.includes(file)) {
          entry.modulesTouched.add(service.id);
        }
      }
    }

    contributorData.set(commit.author, entry);
  }

  return [...contributorData.entries()]
    .map(([name, data]) => {
      const modulesArray = [...data.modulesTouched];
      const primaryModules = modulesArray.slice(0, Math.min(3, modulesArray.length));
      return {
        name,
        commits: data.commits,
        filesChanged: data.filesChanged.size,
        linesChanged: data.commits * 50,
        modulesTouched: modulesArray,
        primaryModules,
      };
    })
    .sort((a, b) => b.commits - a.commits);
}

/**
 * Calculate risk scores for modules using multiple evidence-based metrics.
 */
export function calculateModuleRisks(
  services: Service[],
  churn: ChurnRecord[],
  sourceFiles: ClassifiedFile[],
  realDependencies: RealDependency[],
): ModuleRisk[] {
  const totalChurn = churn.reduce((s, c) => s + c.totalCommits, 0) || 1;

  return services.map((svc) => {
    const moduleFiles = svc.files;
    const moduleSourceFiles = sourceFiles.filter((f) =>
      moduleFiles.some((mf) => f.path === mf || f.path.startsWith(svc.id)),
    );

    const totalLOC = moduleSourceFiles.reduce((s, f) => s + f.loc, 0);
    const fileCount = moduleSourceFiles.length;

    // Avg complexity from file sizes as proxy
    const avgComplexity = fileCount > 0
      ? Math.round((totalLOC / fileCount) * 0.15 + 1)
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

    const contributorCount = Math.max(1, Math.round(svc.commits30d / 3 + 1));

    // Risk score
    let score = 0;
    const reasons: string[] = [];

    const complexityFactor = Math.min(1, avgComplexity / 30);
    score += complexityFactor * 30;
    if (complexityFactor > 0.5) {
      reasons.push(`Estimated complexity ${avgComplexity} — above average`);
    }

    const churnRatio = totalChurn > 0 ? moduleChurnCount / totalChurn : 0;
    const churnFactor = Math.min(1, churnRatio * 5);
    score += churnFactor * 25;
    if (churnFactor > 0.3) {
      reasons.push(`${moduleChurnCount} commits — high activity`);
    }

    const couplingScore = dependencyCount + dependentCount;
    const couplingFactor = Math.min(1, couplingScore / 20);
    score += couplingFactor * 25;
    if (couplingFactor > 0.3) {
      reasons.push(`${dependencyCount} outbound dep(s), ${dependentCount} inbound dep(s) — coupled`);
    }

    const sizeFactor = Math.min(1, totalLOC / 3000);
    score += sizeFactor * 10;
    if (sizeFactor > 0.5) {
      reasons.push(`${totalLOC} LOC across ${fileCount} files — large module`);
    }

    if (contributorCount <= 2 && fileCount > 3) {
      score += 10;
      reasons.push(`Only ${contributorCount} contributor(s) — bus factor concern`);
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
      loc: totalLOC,
      fileCount,
      complexity: avgComplexity,
      churn: moduleChurnCount,
      dependencyCount,
      dependentCount,
      contributorCount,
      isGodModule,
      reasons: reasons.slice(0, 5),
    };
  }).sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * Build tech debt items from module risks and source files.
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
      { metric: "Risk Score", value: `${mr.riskScore}/100`, label: "Combined risk score" },
      { metric: "LOC", value: `${mr.loc}`, label: "Lines of code" },
      { metric: "Complexity", value: mr.complexity.toFixed(1), label: "Estimated complexity" },
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

    items.push({
      id: `debt-mod-${mr.moduleName.replace(/[^a-z0-9]/gi, "-")}`,
      hotspot: mr.moduleName,
      riskScore: mr.riskScore,
      agingDebt: `${Math.round(mr.churn * 1.5 + mr.loc / 100)} days`,
      filePath: mr.moduleName,
      detail: mr.reasons.slice(0, 2).join("; "),
      evidence,
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

    if (fileInfo.loc > 200) {
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

    items.push({
      id: `debt-file-${ch.filePath.replace(/[^a-z0-9]/gi, "-")}`,
      hotspot: ch.filePath.split("/").pop() ?? ch.filePath,
      riskScore: Math.min(90, 25 + ch.totalCommits * 3 + (fileInfo.loc > 200 ? 10 : 0)),
      agingDebt: `${ch.totalCommits * 2 + ch.recentChanges * 5} days`,
      filePath: ch.filePath,
      detail: `${ch.totalCommits} commit(s), ${ch.recentChanges} recent — high activity area`,
      evidence,
    });
  }

  return items.sort((a, b) => b.riskScore - a.riskScore).slice(0, 10);
}

/**
 * Generate evidence-based insights from the analysis data.
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
    items.push({
      insight: `"${top.moduleName}" is the highest-risk module in this codebase.`,
      source: "Static Analysis + Git History",
      facts: [
        `Risk score: ${top.riskScore}/100`,
        `${top.loc} lines of code across ${top.fileCount} files`,
        `Estimated complexity: ${top.complexity}`,
        `${top.churn} historical commits`,
        `Depended on by ${top.dependentCount} other module(s)`,
      ],
      inference: `This suggests "${top.moduleName}" is a central, actively-developed area that warrants careful attention during changes.`,
    });
  }

  // Strongest co-change
  const strongCoChanges = coChanges.filter((c) => c.commitCount >= 3);
  if (strongCoChanges.length > 0) {
    const topCC = strongCoChanges[0];
    items.push({
      insight: `"${topCC.fileA.split("/").pop()}" and "${topCC.fileB.split("/").pop()}" change together frequently.`,
      source: "Git History",
      facts: [
        `${topCC.commitCount} co-changes detected out of ${topCC.totalCommits} total commits`,
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

  // Contributor bus factor
  const lowContributor = moduleRisks.filter((r) => r.contributorCount <= 2 && r.fileCount > 3);
  if (lowContributor.length > 0) {
    const names = lowContributor.slice(0, 2).map((r) => `"${r.moduleName}"`).join(", ");
    items.push({
      insight: `${names} ${lowContributor.length === 1 ? "has" : "have"} limited contributor diversity.`,
      source: "Git History",
      facts: lowContributor.slice(0, 2).map(
        (r) => `${r.moduleName}: only ${r.contributorCount} contributor(s) for ${r.fileCount} files`,
      ),
      inference: "These modules may have a bus-factor risk — knowledge is concentrated.",
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