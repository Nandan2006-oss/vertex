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