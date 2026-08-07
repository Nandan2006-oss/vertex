/**
 * Smart file classification for repository analysis.
 *
 * Separates files into SOURCE, BUILD, CONFIG, DOCUMENTATION, TEST,
 * ASSET, GENERATED, DATA, and UNKNOWN categories.
 *
 * Documentation/configuration files are NEVER treated as source-code
 * dependencies or technical debt hotspots.
 */

import type { FileCategory } from "./types";

/** Paths (any depth) that should be ignored entirely */
const IGNORED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "venv",
  ".venv",
  "__pycache__",
  "dist",
  "build",
  "target",
  "coverage",
  "vendor",
  "generated",
  "bin",
  "obj",
  ".next",
  ".nuxt",
  ".cache",
  ".turbo",
  ".parcel-cache",
  "Pods",
  ".idea",
  ".vscode",
  ".DS_Store",
  ".gitlab",
  ".github",
  "out",
  "debug",
  "release",
  ".gradle",
  "assets",
]);

/** Files to skip entirely */
const IGNORED_FILES = new Set([
  ".DS_Store",
  "Thumbs.db",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "npm-shrinkwrap.json",
  ".gitignore",
  ".gitattributes",
  ".gitmodules",
  ".editorconfig",
  ".prettierrc",
  ".eslintrc",
  ".eslintrc.json",
  ".eslintrc.js",
  ".prettierignore",
  "LICENSE",
  "LICENSE.md",
  "LICENSE.txt",
  "COPYING",
  "COPYING.md",
  "COPYING.txt",
  "AUTHORS",
  "CONTRIBUTORS",
  "CHANGELOG",
  "CHANGELOG.md",
  "CHANGELOG.txt",
]);

/** Source-code file extensions by language */
const SOURCE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "mts", "cts",
  "py", "pyw", "pyx", "pxd",
  "go",
  "rs",
  "java", "kt", "kts", "scala", "clj", "cljs",
  "rb",
  "php",
  "c", "cpp", "cxx", "cc", "h", "hpp", "hxx", "hh", "tpp", "tcc",
  "cs",
  "swift",
  "dart",
  "lua",
  "r",
  "ex", "exs",
  "hs",
  "zig",
  "sol",
  "vue", "svelte", "astro",
]);

/** Header file extensions (C/C++) */
const HEADER_EXTENSIONS = new Set([
  "h", "hpp", "hxx", "hh", "h++", "tpp", "tcc", "inl", "ipp",
]);

/** Test files — paths or patterns identifying test code */
const TEST_PATTERNS = [
  /\/test[s]?\//i,
  /\/spec[s]?\//i,
  /\/__tests__\//,
  /\/__mocks__\//,
  /\.test\./,
  /\.spec\./,
  /_test\./,
  /_spec\./,
  /\btest_/,
  /\btests\//i,
  /\/testing\//i,
  /\/mock[s]?\//i,
  /\/fixtures?\//i,
  /\/e2e\//i,
  /\/cypress\//i,
  /\/playwright\//i,
];

/** Build system / config files */
const BUILD_PATTERNS = [
  /^CMakeLists\.txt$/,
  /\.pro$/,
  /\.pri$/,
  /Makefile$/,
  /makefile$/,
  /^Cargo\.toml$/,
  /^build\.gradle$/,
  /^BUILD$/,
  /^BUILD\.bazel$/,
  /^meson\.build$/,
  /^setup\.py$/,
  /^setup\.cfg$/,
  /^pyproject\.toml$/,
  /^requirements.*\.txt$/,
  /^Pipfile$/,
  /^Dockerfile/,
  /^docker-compose/,
  /^\.dockerignore$/,
  /^Jenkinsfile$/,
  /^\.github\/workflows\//,
  /^\.gitlab-ci\.yml$/,
  /\.bazel$/,
  /^webpack\.config/,
  /^vite\.config/,
  /^rollup\.config/,
  /^next\.config/,
  /^nuxt\.config/,
  /^tsconfig\.json$/,
  /^package\.json$/,
  /^\.npmrc$/,
];

/** Config file patterns */
const CONFIG_PATTERNS = [
  /\.ya?ml$/,
  /\.toml$/,
  /\.json$/,
  /\.ini$/,
  /\.cfg$/,
  /\.conf$/,
  /\.env\b/,
  /\.env\.example$/,
  /^\.env\b/,
  /^docker-compose/,
  /\.editorconfig$/,
  /\.prettierrc/,
  /\.eslintrc/,
  /\.stylelintrc/,
  /\.babelrc/,
  /\.browserslistrc$/,
  /^tailwind\.config/,
  /^postcss\.config/,
  /\.terraform\b/,
  /\.tfvars$/,
  /\.tfstate/,
];

/** Documentation patterns */
const DOC_PATTERNS = [
  /\.md$/,
  /\.mdx$/,
  /\.txt$/,
  /^README/i,
  /^CHANGELOG/i,
  /^CONTRIBUTING/i,
  /^CODE_OF_CONDUCT/i,
  /^LICENSE/i,
  /^COPYING/i,
  /^AUTHORS/i,
  /^SECURITY/i,
  /^SUPPORT/i,
  /^docs\//i,
  /^documentation\//i,
  /\/README/i,
];

/** Generated file patterns */
const GENERATED_PATTERNS = [
  /\.min\.(js|css)$/,
  /\.bundle\./,
  /\.generated\./,
  /^generated\//,
  /\.g\.ts$/,
  /\.g\.py$/,
  /\.pb\./,
  /_pb2?\.py$/,
  /_grpc\.py$/,
  /\.d\.ts$/,
  /\.d\.cts$/,
  /\.d\.mts$/,
];

/** Asset/binary file extensions */
const ASSET_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "svg", "ico", "webp", "bmp",
  "woff", "woff2", "ttf", "eot", "otf",
  "mp3", "wav", "ogg", "flac",
  "mp4", "webm", "avi",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "zip", "tar", "gz", "7z", "rar",
]);

/** Data file extensions */
const DATA_EXTENSIONS = new Set([
  "csv", "tsv", "json", "xml", "yaml", "yml", "sql", "db", "sqlite",
  "graphql", "gql",
]);

export function isIgnored(path: string): boolean {
  const parts = path.split("/");
  if (parts.some((p) => IGNORED_DIRECTORIES.has(p))) return true;
  const filename = parts[parts.length - 1];
  if (IGNORED_FILES.has(filename)) return true;
  return false;
}

export function classifyFile(path: string): FileCategory {
  const filename = path.split("/").pop() ?? path;

  // Generated files first (override everything else)
  if (GENERATED_PATTERNS.some((p) => p.test(path) || p.test(filename))) {
    return "generated";
  }

  // Test files
  if (TEST_PATTERNS.some((p) => p.test(path) || p.test(filename))) {
    return "test";
  }

  // Build config
  if (BUILD_PATTERNS.some((p) => p.test(path) || p.test(filename))) {
    return "build";
  }

  // Documentation
  if (DOC_PATTERNS.some((p) => p.test(path) || p.test(filename))) {
    return "documentation";
  }

  // Assets
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ASSET_EXTENSIONS.has(ext)) {
    return "asset";
  }

  // Config (check after build, since build is a subtype of config)
  if (CONFIG_PATTERNS.some((p) => p.test(path) || p.test(filename))) {
    return "config";
  }

  // Data
  if (DATA_EXTENSIONS.has(ext)) {
    return "data";
  }

  // Source code
  if (SOURCE_EXTENSIONS.has(ext)) {
    return "source";
  }

  // Headers
  if (HEADER_EXTENSIONS.has(ext)) {
    return "header";
  }

  return "unknown";
}

export function isSourceOrHeader(category: FileCategory): boolean {
  return category === "source" || category === "header";
}

export function isRelevantForAnalysis(category: FileCategory): boolean {
  return category === "source" || category === "header" || category === "test" || category === "build";
}

/**
 * Group classified files by category.
 */
export function groupByCategory(
  files: { path: string; category: FileCategory }[]
): { category: FileCategory; count: number; files: string[] }[] {
  const map = new Map<FileCategory, string[]>();
  for (const f of files) {
    const arr = map.get(f.category) ?? [];
    arr.push(f.path);
    map.set(f.category, arr);
  }
  return [...map.entries()]
    .map(([category, files]) => ({ category, count: files.length, files }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Given a map of extension → lines, build language list.
 */
export function buildLanguages(
  extLines: Record<string, number>,
): { name: string; percentage: number; color: string }[] {
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
    dart: { name: "Dart", color: "#00b4ab" },
    html: { name: "HTML", color: "#e34c26" },
    css: { name: "CSS", color: "#563d7c" },
    scss: { name: "SCSS", color: "#c6538c" },
    less: { name: "Less", color: "#1d365d" },
    vue: { name: "Vue", color: "#41b883" },
    svelte: { name: "Svelte", color: "#ff3e00" },
    astro: { name: "Astro", color: "#ff5a03" },
    ex: { name: "Elixir", color: "#6e4a7e" },
    clj: { name: "Clojure", color: "#db5855" },
    hs: { name: "Haskell", color: "#5e5086" },
    lua: { name: "Lua", color: "#000080" },
    zig: { name: "Zig", color: "#ec915c" },
  };

  const groups = new Map<string, { name: string; color: string; lines: number }>();

  for (const [ext, lines] of Object.entries(extLines)) {
    const info = EXT_MAP[ext];
    const key = info?.name ?? ext.toUpperCase();
    const existing = groups.get(key);
    if (existing) {
      existing.lines += lines;
    } else {
      groups.set(key, {
        name: info?.name ?? key,
        color: info?.color ?? "#888",
        lines,
      });
    }
  }

  const total = [...groups.values()].reduce((s, g) => s + g.lines, 0);
  if (total === 0) return [];

  return [...groups.entries()]
    .map(([, g]) => ({
      name: g.name,
      percentage: Math.round((g.lines / total) * 1000) / 10,
      color: g.color,
    }))
    .sort((a, b) => b.percentage - a.percentage);
}