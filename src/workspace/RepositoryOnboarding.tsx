import { FormEvent, useRef, useState } from "react";
import { FolderOpen, FlaskConical } from "lucide-react";
import { SiGithub } from "react-icons/si";

export type RepositorySource = "local" | "github";

export interface RepositoryInfo {
  source: RepositorySource;
  /** Display name shown in the shell header, e.g. "acme/api" or "my-project" */
  name: string;
  /** Raw path or URL as provided by the user */
  raw?: string;
}

interface RepositoryOnboardingProps {
  onAnalyze: (repo: RepositoryInfo, files?: File[]) => void;
  onLoadDemo?: () => void;
}

/** Extract a display repo name from a GitHub URL, SSH form, or "owner/repo". */
function repoNameFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let cleaned = trimmed;
  if (/^(?:https?:\/\/|git@|ssh:\/\/)/i.test(cleaned)) {
    cleaned = cleaned.replace(/^(?:https?:\/\/|git@|ssh:\/\/)/i, "");
    cleaned = cleaned.replace(/^[^/\s:]+[/:]/i, "");
  }
  cleaned = cleaned.replace(/\.git$/i, "").replace(/\/+$/, "");
  if (/\s/.test(cleaned)) return null;

  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length >= 2) return parts.slice(-2).join("/");
  if (parts.length === 1) return parts[0];
  return null;
}

export function RepositoryOnboarding({ onAnalyze, onLoadDemo }: RepositoryOnboardingProps) {
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [showGithubForm, setShowGithubForm] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFolderPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileList = Array.from(files);
      const first = fileList[0] as File & { webkitRelativePath?: string };
      const relPath = first.webkitRelativePath ?? "";
      const folderName =
        relPath.split("/")[0] ||
        first.name.replace(/\.[^/.]+$/, "") ||
        "local-repository";
      onAnalyze(
        { source: "local", name: folderName, raw: relPath },
        fileList,
      );
    }
    e.target.value = "";
  };

  const handleGithubSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = repoNameFromInput(githubUrl);
    if (!name) {
      setError(
        "That doesn't look like a valid repository URL. Try a format like https://github.com/facebook/react",
      );
      return;
    }
    setError(null);
    onAnalyze({ source: "github", name, raw: githubUrl.trim() });
  };

  return (
    <div className="animate-fade-in flex w-full max-w-xl flex-col items-center px-4 py-8 text-center">
      {/* Title */}
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Connect a Codebase
      </h1>
      <p className="mt-2 text-sm text-secondary max-w-md">
        Extract architecture topology, dependency trees, git churn, and technical debt from real code evidence.
      </p>

      {/* Primary 2 Actions */}
      <div className="mt-8 grid w-full gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          className="group flex cursor-pointer flex-col items-center gap-3 rounded-md border border-border bg-surface p-6 text-center transition-all hover:border-accent/50 hover:bg-raised shadow-2xs"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-sm bg-accent-muted text-accent group-hover:scale-105 transition-transform">
            <FolderOpen className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">
              Local Repository Folder
            </span>
            <span className="text-xs text-muted mt-0.5">
              Select a project from your machine
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setShowGithubForm((v) => !v)}
          aria-expanded={showGithubForm}
          className="group flex cursor-pointer flex-col items-center gap-3 rounded-md border border-border bg-surface p-6 text-center transition-all hover:border-accent/50 hover:bg-raised shadow-2xs"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-sm bg-raised text-foreground group-hover:scale-105 transition-transform">
            <SiGithub className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">
              GitHub Repository
            </span>
            <span className="text-xs text-muted mt-0.5">
              Analyze public URL with full git history
            </span>
          </div>
        </button>
      </div>

      {/* GitHub URL Input Form */}
      {showGithubForm && (
        <form
          onSubmit={handleGithubSubmit}
          className="mt-4 w-full animate-slide-up rounded-md border border-border bg-surface p-4 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              autoFocus
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              className="flex-1 rounded-xs border border-border bg-raised/50 px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted focus:border-accent focus:outline-hidden"
            />
            <button
              type="submit"
              className="cursor-pointer rounded-xs bg-accent px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 active:scale-95 shrink-0"
            >
              Start Analysis
            </button>
          </div>
          {error && <p className="mt-2 text-left text-xs text-rust font-medium">{error}</p>}
        </form>
      )}

      {/* Demo Project Alternative */}
      {onLoadDemo && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <span className="text-xs text-muted">or explore without onboarding code</span>
          <button
            type="button"
            onClick={onLoadDemo}
            className="flex cursor-pointer items-center gap-2 rounded-xs border border-border bg-raised/60 px-3 py-1.5 text-xs text-secondary hover:text-foreground hover:bg-raised transition-colors"
          >
            <FlaskConical className="h-3.5 w-3.5 text-accent" />
            <span>Load Pre-computed Demo Architecture</span>
          </button>
        </div>
      )}

      {/* Hidden Folder Input */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard in browser engines
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={handleFolderPicked}
      />
    </div>
  );
}
