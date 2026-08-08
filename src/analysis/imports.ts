/**
 * Regex-based import/include dependency parser.
 *
 * Parses actual source code to extract real dependencies.
 * Supports: Python, JavaScript/TypeScript, C/C++, Java.
 *
 * Distinguishes INTERNAL dependencies (files within the repo)
 * from EXTERNAL dependencies (libraries, frameworks, system headers).
 */

import type { RealDependency } from "./types";

export interface ParsedImport {
  /** The raw matched import line */
  raw: string;
  /** Module/symbol name being imported */
  name: string;
  /** Whether this looks like an internal file reference */
  isInternal: boolean;
  /** If internal, the resolved file path (may be relative) */
  internalPath?: string;
}

/**
 * Try to resolve a relative import path to an absolute-ish repo path.
 * Given the source file path and the import target, returns a best-guess
 * resolved path within the repo.
 */
export function resolveImportPath(
  sourceFile: string,
  importTarget: string,
  knownExtensions: string[] = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".cpp", ".hpp", ".h", ".hxx", ".cxx", ".cc", ".c", ".java"],
): string | null {
  if (importTarget.startsWith(".")) {
    const dir = sourceFile.includes("/")
      ? sourceFile.slice(0, sourceFile.lastIndexOf("/"))
      : "";
    const resolved = dir ? `${dir}/${importTarget}` : importTarget;

    // Normalize path (remove ./ and ../)
    const parts = resolved.split("/");
    const normalized: string[] = [];
    for (const p of parts) {
      if (p === "." || p === "") continue;
      if (p === "..") {
        if (normalized.length > 0) normalized.pop();
      } else {
        normalized.push(p);
      }
    }
    const base = normalized.join("/");

    // Try with known extensions
    for (const ext of knownExtensions) {
      const candidate = `${base}${ext}`;
      // Return the first match — caller filters against actual file list
      if (candidate) return candidate;
    }
    // Also try as-is (no extension)
    return base;
  }
  return null;
}

/** Check if an import path points to an internal file within the repo */
export function isInternalImport(importTarget: string): boolean {
  return importTarget.startsWith(".") || importTarget.startsWith("/");
}

/**
 * Strip single-line comments from Python source text (before parsing).
 * Also strips multi-line string literals used as docstrings/block comments.
 */
function stripPythonComments(text: string): string {
  // Remove # comments (but not inside strings — approximate via line-based)
  const lines = text.split("\n");
  const result: string[] = [];
  let inTriple = false;
  for (const line of lines) {
    if (!inTriple) {
      if (line.includes('"""') || line.includes("'''")) {
        // Track triple-quote starts/stops
        const tripleIdx = Math.max(
          line.indexOf('"""') >= 0 ? line.indexOf('"""') : Infinity,
          line.indexOf("'''") >= 0 ? line.indexOf("'''") : Infinity,
        );
        if (tripleIdx < Infinity) {
          const beforeTriple = line.slice(0, tripleIdx);
          const hashIdx = beforeTriple.indexOf("#");
          result.push(hashIdx >= 0 ? beforeTriple.slice(0, hashIdx) : beforeTriple);
          inTriple = !inTriple;
          continue;
        }
      }
      const hashIdx = line.indexOf("#");
      result.push(hashIdx >= 0 ? line.slice(0, hashIdx) : line);
    } else {
      if (line.includes('"""') || line.includes("'''")) inTriple = !inTriple;
      result.push("");
    }
  }
  return result.join("\n");
}

/**
 * Parse Python imports from source text.
 * Correctly identifies local relative imports (from .xxx import Y).
 */
export function parsePythonImports(sourceText: string, sourceFile: string): ParsedImport[] {
  const results: ParsedImport[] = [];
  const cleaned = stripPythonComments(sourceText);

  // Relative imports: from .module import X, from ..parent import Y
  let relRe = /^\s*from\s+(\.+)([a-zA-Z_][\w.]*)?\s+import/gm;
  let match;
  while ((match = relRe.exec(cleaned)) !== null) {
    const dotCount = match[1].length;
    const modPath = (match[2] ?? "").trim().replace(/\./g, "/");
    const sourceDir = sourceFile.includes("/") ? sourceFile.slice(0, sourceFile.lastIndexOf("/")) : "";
    const parts = sourceDir.split("/");
    let remaining = dotCount;
    while (remaining > 1 && parts.length > 0) {
      parts.pop();
      remaining--;
    }
    const resolvedDir = parts.join("/");
    const resolvedPath = modPath ? `${resolvedDir}/${modPath}` : resolvedDir;
    results.push({
      raw: match[0].trim(),
      name: resolvedPath,
      isInternal: true,
      internalPath: resolvedPath,
    });
  }

  // import X, import X.Y.Z
  const importRegex = /^\s*import\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gm;
  while ((match = importRegex.exec(cleaned)) !== null) {
    const name = match[1].trim();
    const topLevel = name.split(".")[0];
    results.push({
      raw: match[0].trim(),
      name: topLevel,
      isInternal: false,
      internalPath: topLevel,
    });
  }

  // from X import Y (absolute imports — treat as external unless known otherwise)
  const fromRegex = /^\s*from\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s+import/gm;
  while ((match = fromRegex.exec(cleaned)) !== null) {
    const name = match[1].trim();
    const topLevel = name.split(".")[0];
    results.push({
      raw: match[0].trim(),
      name: topLevel,
      isInternal: false,
      internalPath: undefined,
    });
  }

  return results;
}

/**
 * Strip JS/TS-style comments from source text.
 * Handles // single-line, /* * / block, and template literals.
 */
function stripJSTSComments(text: string): string {
  // Remove // line comments (but not inside strings)
  const lines = text.split("\n");
  const result: string[] = [];
  let inBlockComment = false;
  for (let line of lines) {
    if (inBlockComment) {
      const endIdx = line.indexOf("*/");
      if (endIdx >= 0) {
        line = line.slice(endIdx + 2);
        inBlockComment = false;
      } else {
        result.push("");
        continue;
      }
    }
    // Remove /* ... */ block comments
    let blockStart = line.indexOf("/*");
    while (blockStart >= 0) {
      const blockEnd = line.indexOf("*/", blockStart + 2);
      if (blockEnd >= 0) {
        line = line.slice(0, blockStart) + " " + line.slice(blockEnd + 2);
      } else {
        inBlockComment = true;
        line = line.slice(0, blockStart);
        break;
      }
      blockStart = line.indexOf("/*");
    }
    // Remove // line comments (but skip if inside a string)
    // Simple approach: remove // that appears outside quotes
    const segments = line.split('"');
    for (let i = 0; i < segments.length; i++) {
      if (i % 2 === 0) {
        // Outside double-quote string — check for //
        const slashIdx = segments[i].indexOf("//");
        if (slashIdx >= 0) {
          segments[i] = segments[i].slice(0, slashIdx);
        }
      }
    }
    line = segments.join('"');
    result.push(line);
  }
  return result.join("\n");
}

/**
 * Parse JavaScript/TypeScript imports from source text.
 * Handles comments and template literals.
 */
export function parseTypeScriptImports(sourceText: string, _sourceFile: string): ParsedImport[] {
  const results: ParsedImport[] = [];
  const cleaned = stripJSTSComments(sourceText);

  // import X from "Y"
  let re = /(?:import\s+(?:\{[^}]*\}\s*|(?:[\w*\s,]*))?\s*from\s*["']([^"']+)["'])/g;
  let match;
  while ((match = re.exec(cleaned)) !== null) {
    const target = match[1];
    if (!target) continue;
    const isInternal = isInternalImport(target);
    results.push({
      raw: match[0].trim(),
      name: target,
      isInternal,
      internalPath: isInternal ? target : undefined,
    });
  }

  // import "Y"
  re = /^\s*import\s+["']([^"']+)["']/gm;
  while ((match = re.exec(cleaned)) !== null) {
    const target = match[1];
    if (!target) continue;
    const isInternal = isInternalImport(target);
    results.push({
      raw: match[0].trim(),
      name: target,
      isInternal,
      internalPath: isInternal ? target : undefined,
    });
  }

  // require("Y")
  re = /(?:require|require\.resolve)\s*\(\s*["']([^"']+)["']\s*\)/g;
  while ((match = re.exec(cleaned)) !== null) {
    const target = match[1];
    if (!target) continue;
    const isInternal = isInternalImport(target);
    // Avoid duplicates
    if (!results.some((r) => r.name === target)) {
      results.push({
        raw: match[0].trim(),
        name: target,
        isInternal,
        internalPath: isInternal ? target : undefined,
      });
    }
  }

  return results;
}

/**
 * Parse C/C++ #include directives from source text.
 */
export function parseCppIncludes(sourceText: string, _sourceFile: string): ParsedImport[] {
  const results: ParsedImport[] = [];

  // #include "file.h" — local includes (internal)
  let re = /#\s*include\s+"([^"]+)"/g;
  let match;
  while ((match = re.exec(sourceText)) !== null) {
    const target = match[1];
    results.push({
      raw: match[0].trim(),
      name: target,
      isInternal: true,
      internalPath: target,
    });
  }

  // #include <library> — system includes (external)
  re = /#\s*include\s+<([^>]+)>/g;
  while ((match = re.exec(sourceText)) !== null) {
    const target = match[1];
    results.push({
      raw: match[0].trim(),
      name: target,
      isInternal: false,
      internalPath: undefined,
    });
  }

  return results;
}

/**
 * Parse Java imports from source text.
 */
export function parseJavaImports(sourceText: string, _sourceFile: string): ParsedImport[] {
  const results: ParsedImport[] = [];

  // import com.example.Foo;
  // import com.example.*;
  const re = /^\s*import\s+(?:static\s+)?([a-zA-Z_][\w.]*(?:\.\*)?);/gm;
  let match;
  while ((match = re.exec(sourceText)) !== null) {
    const fullName = match[1];
    results.push({
      raw: match[0].trim(),
      name: fullName,
      isInternal: false,
      internalPath: undefined,
    });
  }

  return results;
}

/**
 * Detect programming language from file path/extension.
 */
export function detectImportParser(sourceFile: string): "python" | "typescript" | "cpp" | "java" | null {
  const ext = sourceFile.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "py":
    case "pyw":
    case "pyx":
      return "python";
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
    case "mts":
    case "cts":
      return "typescript";
    case "c":
    case "cpp":
    case "cxx":
    case "cc":
    case "h":
    case "hpp":
    case "hxx":
    case "hh":
      return "cpp";
    case "java":
      return "java";
    default:
      return null;
  }
}

/**
 * Parse imports from source text, auto-detecting the language.
 * Returns an empty array if the language is not supported.
 */
export function parseImports(
  sourceText: string,
  sourceFile: string,
): ParsedImport[] {
  const parser = detectImportParser(sourceFile);
  if (!parser) return [];

  switch (parser) {
    case "python":
      return parsePythonImports(sourceText, sourceFile);
    case "typescript":
      return parseTypeScriptImports(sourceText, sourceFile);
    case "cpp":
      return parseCppIncludes(sourceText, sourceFile);
    case "java":
      return parseJavaImports(sourceText, sourceFile);
    default:
      return [];
  }
}

/**
 * Convert parsed imports into RealDependency objects,
 * given the set of known source files in the repo.
 */
export function importsToDependencies(
  sourceFile: string,
  parsed: ParsedImport[],
  knownFiles: Set<string>,
): RealDependency[] {
  const deps: RealDependency[] = [];
  const seen = new Set<string>();

  const extOrder = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".cpp", ".hpp", ".h", ".hxx", ".cxx", ".cc", ".c"];

  for (const p of parsed) {
    if (p.isInternal && p.internalPath) {
      // Resolve relative imports against known files
      const importPath = p.internalPath.replace(/^\.\//, "");
      const dir = sourceFile.includes("/")
        ? sourceFile.slice(0, sourceFile.lastIndexOf("/") + 1)
        : "";
      const candidate = dir ? `${dir}${importPath}` : importPath;

      // Normalize path
      const parts = candidate.split("/");
      const normalized: string[] = [];
      for (const part of parts) {
        if (part === "." || part === "") continue;
        if (part === "..") {
          if (normalized.length > 0) normalized.pop();
        } else {
          normalized.push(part);
        }
      }
      const resolvedBase = normalized.join("/");

      // Try to find the matching file in known files
      let matchedFile: string | null = null;

      // Try exact match
      if (knownFiles.has(resolvedBase)) {
        matchedFile = resolvedBase;
      }

      // Try with extensions
      if (!matchedFile) {
        for (const ext of extOrder) {
          const candidate = `${resolvedBase}${ext}`;
          if (knownFiles.has(candidate)) {
            matchedFile = candidate;
            break;
          }
        }
      }

      // Try index files
      if (!matchedFile) {
        for (const idx of ["index.ts", "index.tsx", "index.js", "index.jsx", "index.mjs"]) {
          const candidate = `${resolvedBase}/${idx}`;
          if (knownFiles.has(candidate)) {
            matchedFile = candidate;
            break;
          }
        }
      }

      if (matchedFile && matchedFile !== sourceFile) {
        const key = `${sourceFile}→${matchedFile}`;
        if (!seen.has(key)) {
          seen.add(key);
          deps.push({
            fromFile: sourceFile,
            toFile: matchedFile,
            kind: p.name.startsWith("#") ? "include" :
                  p.name.startsWith(".") ? "import" : "import",
            evidence: p.raw,
            external: false,
          });
        }
      }
    } else {
      // External dependency
      const key = `ext:${sourceFile}→${p.name}`;
      if (!seen.has(key)) {
        seen.add(key);
        // For C++ include <library>, extract just the top-level name
        const extName = p.name.includes("/") ? p.name.split("/")[0] : p.name;
        deps.push({
          fromFile: sourceFile,
          toFile: `[external] ${extName}`,
          kind: "import",
          evidence: p.raw,
          external: true,
          externalName: extName,
        });
      }
    }
  }

  return deps;
}