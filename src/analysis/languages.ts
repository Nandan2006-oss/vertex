/**
 * Language detection → re-exports from classify module.
 * Kept for backward compatibility.
 */

import { buildLanguages as classifyBuildLanguages } from "./classify";

export interface LangInfo {
  name: string;
  color: string;
}

const EXT_MAP: Record<string, { name: string; color: string }> = {
  ts: { name: "TypeScript", color: "#3178c6" },
  tsx: { name: "TypeScript React", color: "#3178c6" },
  js: { name: "JavaScript", color: "#f7df1e" },
  jsx: { name: "JavaScript React", color: "#f7df1e" },
  mjs: { name: "JavaScript", color: "#f7df1e" },
  cjs: { name: "JavaScript", color: "#f7df1e" },
  py: { name: "Python", color: "#3572a5" },
  go: { name: "Go", color: "#00add8" },
  rs: { name: "Rust", color: "#dea584" },
  java: { name: "Java", color: "#b07219" },
  rb: { name: "Ruby", color: "#701516" },
  php: { name: "PHP", color: "#4f5d95" },
  c: { name: "C", color: "#555555" },
  cpp: { name: "C++", color: "#f34b7d" },
  h: { name: "C++ Header", color: "#f34b7d" },
  hpp: { name: "C++ Header", color: "#f34b7d" },
  cs: { name: "C#", color: "#178600" },
  swift: { name: "Swift", color: "#f05138" },
  kt: { name: "Kotlin", color: "#a97bff" },
  scala: { name: "Scala", color: "#c22d40" },
  html: { name: "HTML", color: "#e34c26" },
  css: { name: "CSS", color: "#563d7c" },
  scss: { name: "SCSS", color: "#c6538c" },
  less: { name: "Less", color: "#1d365d" },
  vue: { name: "Vue", color: "#41b883" },
  svelte: { name: "Svelte", color: "#ff3e00" },
  astro: { name: "Astro", color: "#ff5a03" },
  md: { name: "Markdown", color: "#083fa1" },
  json: { name: "JSON", color: "#292929" },
  yaml: { name: "YAML", color: "#cb171e" },
  yml: { name: "YAML", color: "#cb171e" },
  toml: { name: "TOML", color: "#9c4221" },
  sh: { name: "Shell", color: "#89e051" },
  bash: { name: "Shell", color: "#89e051" },
  zsh: { name: "Shell", color: "#89e051" },
  dockerfile: { name: "Dockerfile", color: "#384d54" },
  sql: { name: "SQL", color: "#e38c00" },
  dart: { name: "Dart", color: "#00b4ab" },
  ex: { name: "Elixir", color: "#6e4a7e" },
  exs: { name: "Elixir", color: "#6e4a7e" },
  clj: { name: "Clojure", color: "#db5855" },
  hs: { name: "Haskell", color: "#5e5086" },
  lua: { name: "Lua", color: "#000080" },
  zig: { name: "Zig", color: "#ec915c" },
};

export function detectLanguage(filename: string): LangInfo | null {
  const dotIdx = filename.lastIndexOf(".");
  if (dotIdx === -1) return null;
  const ext = filename.slice(dotIdx + 1).toLowerCase();
  return EXT_MAP[ext] ?? null;
}

export function buildLanguages(
  extLines: Record<string, number>,
): { name: string; percentage: number; color: string }[] {
  return classifyBuildLanguages(extLines);
}

/**
 * Resolve language name from file path.
 */
export function resolveLanguageFromPath(path: string): string | null {
  const info = detectLanguage(path);
  return info?.name ?? null;
}