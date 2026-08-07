import { FormEvent, useRef, useState } from "react";
import { FolderOpen } from "lucide-react";
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
}

/** Extract a display repo name from a GitHub URL, SSH form, or "owner/repo". */
function repoNameFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let cleaned = trimmed;
  if (/^(?:https?:\/\/|git@|ssh:\/\/)/i.test(cleaned)) {
    cleaned = cleaned.replace(/^(?:https?:\/\/|git@|ssh:\/\/)/i, "");
    // Drop the host portion ("github.com/" or "github.com:")
    cleaned = cleaned.replace(/^[^/\s:]+[/:]/i, "");
  }
  cleaned = cleaned.replace(/\.git$/i, "").replace(/\/+$/, "");
  if (/\s/.test(cleaned)) return null;

  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length >= 2) return parts.slice(-2).join("/");
  if (parts.length === 1) return parts[0];
  return null;
}

export function RepositoryOnboarding({ onAnalyze }: RepositoryOnboardingProps) {
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [showGithubForm, setShowGithubForm] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFolderPicked = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
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
    // Reset so picking the same folder again still fires `change`.
    e.target.value = "";
  };

  const handleGithubSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = repoNameFromInput(githubUrl);
    if (!name) {
      setError(
        "That doesn't look like a repository. Try a URL like https://github.com/acme/api",
      );
      return;
    }
    setError(null);
    onAnalyze({ source: "github", name, raw: githubUrl.trim() });
  };

  return (
    <div className="animate-fade-in flex w-full max-w-xl flex-col items-center px-6 py-12 text-center">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Analyze a Repository
      </h1>
      <p className="mt-3 text-secondary">
        Understand your codebase&apos;s evolution.
      </p>

      <div className="mt-10 grid w-full gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          className="group flex cursor-pointer flex-col items-center gap-2 rounded-sm border border-border bg-surface p-6 text-center transition-all duration-150 ease-out-soft hover:bg-raised hover:border-foreground/30 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          <FolderOpen
            className="h-6 w-6 text-secondary transition-colors group-hover:text-foreground"
            aria-hidden="true"
          />
          <span className="text-sm font-medium text-foreground">
            Analyze Local Repository
          </span>
          <span className="text-xs text-muted">
            Pick a folder from your computer
          </span>
        </button>

        <button
          type="button"
          onClick={() => setShowGithubForm((v) => !v)}
          aria-expanded={showGithubForm}
          aria-controls="github-repo-form"
          className="group flex cursor-pointer flex-col items-center gap-2 rounded-sm border border-border bg-surface p-6 text-center transition-all duration-150 ease-out-soft hover:bg-raised hover:border-foreground/30 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          <SiGithub
            className="h-6 w-6 text-secondary transition-colors group-hover:text-foreground"
            aria-hidden="true"
          />
          <span className="text-sm font-medium text-foreground">
            Analyze GitHub Repository
          </span>
          <span className="text-xs text-muted">Paste a repository URL</span>
        </button>
      </div>

      {showGithubForm && (
        <form
          id="github-repo-form"
          onSubmit={handleGithubSubmit}
          className="mt-6 w-full"
        >
          <div className="flex gap-2">
            <label htmlFor="github-url" className="sr-only">
              Repository URL
            </label>
            <input
              id="github-url"
              type="url"
              inputMode="url"
              autoFocus
              value={githubUrl}
              onChange={(e) => {
                setGithubUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder="https://github.com/acme/api"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "github-repo-error" : undefined}
              className="min-w-0 flex-1 rounded-sm border border-border bg-surface px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted transition-colors duration-150 focus:border-foreground focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex cursor-pointer items-center gap-2 rounded-sm bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-all duration-150 ease-out-soft hover:opacity-90 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              Analyze
            </button>
          </div>
          {error && (
            <p id="github-repo-error" role="alert" className="mt-2 text-sm text-rust">
              {error}
            </p>
          )}
        </form>
      )}

      <input
        ref={(el) => {
          folderInputRef.current = el;
          // Non-standard attribute — set on the DOM node directly so the
          // picker opens in directory mode without polluting React's types.
          if (el) el.setAttribute("webkitdirectory", "");
        }}
        type="file"
        multiple
        className="hidden"
        onChange={handleFolderPicked}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
