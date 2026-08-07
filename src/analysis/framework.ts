/**
 * Framework/build-system detection from repository files.
 */

import type { FrameworkInfo } from "./types";

export interface FileContent {
  path: string;
  content: string;
}

/**
 * Detect the project framework and build system from known manifest files.
 * Returns the most confident detection.
 */
export function detectFramework(
  files: FileContent[],
  languages: string[],
): FrameworkInfo | null {
  const results: FrameworkInfo[] = [];

  const hasFile = (name: string) => files.some((f) => f.path === name);
  const hasFileContent = (name: string) => files.find((f) => f.path === name)?.content ?? "";

  // ── Check C/C++ / Qt ──
  if (hasFile("CMakeLists.txt")) {
    results.push({
      name: "CMake",
      buildSystem: "CMake",
      languages: ["C", "C++"],
      confidence: "high",
      evidence: ["CMakeLists.txt found"],
    });
  }
  if (hasFile("Makefile") || hasFile("makefile")) {
    results.push({
      name: "Make",
      buildSystem: "Make",
      languages: ["C", "C++"],
      confidence: "high",
      evidence: ["Makefile found"],
    });
  }

  // Qt-specific: .pro files
  const proFiles = files.filter((f) => f.path.endsWith(".pro"));
  if (proFiles.length > 0) {
    results.push({
      name: "Qt",
      buildSystem: "QMake",
      languages: ["C++"],
      confidence: "high",
      evidence: proFiles.map((f) => `${f.path} (Qt .pro file)`),
    });
  }

  // ── JavaScript / TypeScript ──
  const pkgContent = hasFileContent("package.json");
  if (pkgContent) {
    try {
      const pkg = JSON.parse(pkgContent);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const framework = detectJSFramework(deps);
      if (framework) {
        results.push({
          name: framework,
          buildSystem: pkg.packageManager?.split("@")[0] ?? "npm",
          languages: Object.keys(deps).includes("typescript") || languages.includes("TypeScript")
            ? ["TypeScript", "JavaScript"]
            : ["JavaScript"],
          confidence: "high",
          evidence: [`package.json: has ${framework} dependency`],
        });
      }
      // If no specific framework, just report as JS/TS project
      if (!framework && (languages.includes("TypeScript") || languages.includes("JavaScript"))) {
        const pm = pkg.packageManager?.split("@")[0] ?? "npm";
        results.push({
          name: "Node.js",
          buildSystem: pm,
          languages: languages.includes("TypeScript") ? ["TypeScript", "JavaScript"] : ["JavaScript"],
          confidence: "medium",
          evidence: ["package.json found", `${Object.keys(deps ?? {}).length} dependencies`],
        });
      }
    } catch { /* invalid JSON */ }
  }

  // ── Python ──
  if (hasFile("requirements.txt") || hasFile("setup.py") || hasFile("pyproject.toml")) {
    let evidence: string[] = [];
    let framework = "Python";
    let buildSystem: string | null = null;

    if (hasFile("requirements.txt")) {
      const reqContent = hasFileContent("requirements.txt");
      const reqLines = reqContent.split("\n").map((l) => l.trim().toLowerCase());
      evidence.push("requirements.txt found");

      if (reqLines.some((l) => l.startsWith("django"))) {
        framework = "Django";
        evidence.push("Django detected in requirements.txt");
      } else if (reqLines.some((l) => l.startsWith("flask"))) {
        framework = "Flask";
        evidence.push("Flask detected in requirements.txt");
      } else if (reqLines.some((l) => l.includes("fastapi"))) {
        framework = "FastAPI";
        evidence.push("FastAPI detected in requirements.txt");
      }
    }
    if (hasFile("pyproject.toml")) {
      buildSystem = "setuptools";
      evidence.push("pyproject.toml found");
    }
    if (hasFile("setup.py")) {
      buildSystem = "setuptools";
      evidence.push("setup.py found");
    }

    results.push({
      name: framework,
      buildSystem,
      languages: ["Python"],
      confidence: "high",
      evidence,
    });
  }

  // ── Rust ──
  if (hasFile("Cargo.toml")) {
    results.push({
      name: "Rust",
      buildSystem: "Cargo",
      languages: ["Rust"],
      confidence: "high",
      evidence: ["Cargo.toml found"],
    });
  }

  // ── Go ──
  if (hasFile("go.mod")) {
    results.push({
      name: "Go",
      buildSystem: "Go Modules",
      languages: ["Go"],
      confidence: "high",
      evidence: ["go.mod found"],
    });
  }

  // ── Java / JVM ──
  if (hasFile("pom.xml")) {
    results.push({
      name: "Maven",
      buildSystem: "Maven",
      languages: ["Java"],
      confidence: "high",
      evidence: ["pom.xml found"],
    });
  }
  if (hasFile("build.gradle") || hasFile("build.gradle.kts")) {
    results.push({
      name: "Gradle",
      buildSystem: "Gradle",
      languages: ["Java", "Kotlin"],
      confidence: "high",
      evidence: ["build.gradle found"],
    });
  }

  // ── Ruby on Rails ──
  if (hasFile("Gemfile")) {
    results.push({
      name: "Ruby on Rails",
      buildSystem: "Bundler",
      languages: ["Ruby"],
      confidence: "high",
      evidence: ["Gemfile found"],
    });
  }

  // Return the highest confidence result, or the first one
  if (results.length === 0) return null;

  // Prefer "high" confidence
  const highConfidence = results.filter((r) => r.confidence === "high");
  if (highConfidence.length > 0) return highConfidence[0];
  return results[0];
}

function detectJSFramework(deps: Record<string, string>): string | null {
  const names = Object.keys(deps ?? {}).map((k) => k.toLowerCase());

  // Frontend frameworks (priority order)
  if (names.some((n) => n === "next")) return "Next.js";
  if (names.some((n) => n.startsWith("nuxt"))) return "Nuxt";
  if (names.some((n) => n.startsWith("gatsby"))) return "Gatsby";
  if (names.some((n) => n.startsWith("remix"))) return "Remix";
  if (names.some((n) => n.startsWith("@sveltejs/kit") || n === "sveltekit")) return "SvelteKit";
  if (names.some((n) => n === "react" || n.startsWith("@angular"))) {
    if (names.some((n) => n === "react")) return "React";
    if (names.some((n) => n.startsWith("@angular"))) return "Angular";
  }
  if (names.some((n) => n === "vue" || n === "@vue/cli")) return "Vue";
  if (names.some((n) => n.startsWith("svelte"))) return "Svelte";

  // Backend
  if (names.some((n) => n.startsWith("express"))) return "Express.js";
  if (names.some((n) => n.startsWith("fastify"))) return "Fastify";
  if (names.some((n) => n.startsWith("nestjs") || n === "@nestjs/core")) return "NestJS";

  return null;
}