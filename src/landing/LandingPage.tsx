import { Brand } from "../components/Brand";
import { ThemeToggle } from "../theme/ThemeToggle";
import type { Theme } from "../theme/useTheme";
import { ArchitectureGraph } from "../components/ArchitectureGraph";
import { Reveal } from "./Reveal";
import { services, dependencies, commits } from "../demo-data";

interface LandingPageProps {
  theme: Theme;
  onToggleTheme: () => void;
  onOpenWorkspace: () => void;
}

export function LandingPage({
  theme,
  onToggleTheme,
  onOpenWorkspace,
}: LandingPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Nav theme={theme} onToggleTheme={onToggleTheme} onOpenWorkspace={onOpenWorkspace} />
      <Hero onOpenWorkspace={onOpenWorkspace} />
      <PositioningStrip />
      <Features />
      <WorkspacePreview onOpenWorkspace={onOpenWorkspace} />
      <HistoryTimeline />
      <CtaFooter onOpenWorkspace={onOpenWorkspace} />
    </div>
  );
}

/* ── Nav ────────────────────────────────────────────────────────── */

function Nav({
  theme,
  onToggleTheme,
  onOpenWorkspace,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  onOpenWorkspace: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <a href="#top" className="flex items-center gap-2" aria-label="Vertex home">
          <Brand />
        </a>
        <nav aria-label="Primary" className="hidden items-center gap-7 text-sm text-secondary md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">Product</a>
          <a href="#workspace" className="transition-colors hover:text-foreground">Workspace</a>
          <a href="#history" className="transition-colors hover:text-foreground">About</a>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button
            type="button"
            onClick={onOpenWorkspace}
            className="hidden cursor-pointer items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-sm font-medium transition-all duration-150 ease-out-soft hover:bg-raised active:scale-95 sm:inline-flex"
          >
            Open workspace
          </button>
        </div>
      </div>
    </header>
  );
}

/* ── Hero ───────────────────────────────────────────────────────── */

function Hero({ onOpenWorkspace }: { onOpenWorkspace: () => void }) {
  return (
    <section id="top" className="hero-texture border-b border-border">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
        <div>
          <Reveal>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
              Codebase intelligence platform
            </p>
            <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
              See your system as it really is.
            </h1>
            <p className="mt-5 max-w-md text-secondary">
              Vertex maps your architecture, dependencies, and technical debt —
              so you can see what's healthy, what's evolving, and what's at
              risk before it surfaces in production.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onOpenWorkspace}
                className="inline-flex cursor-pointer items-center gap-2 rounded-sm bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-all duration-150 ease-out-soft hover:opacity-90 active:scale-95"
              >
                Open the workspace
              </button>
              <a
                href="#features"
                className="text-sm text-secondary transition-colors hover:text-foreground"
              >
                Explore the product
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal delay={120}>
          <div className="rounded-sm border border-border bg-surface p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="font-mono text-xs text-muted">vertex/control-plane</span>
              <span className="font-mono text-xs text-muted">live</span>
            </div>
            <ArchitectureGraph
              services={services}
              dependencies={dependencies}
              height={380}
              interactive={false}
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Positioning strip ──────────────────────────────────────────── */

function PositioningStrip() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-10 text-center">
        <Reveal>
          <p className="font-display text-xl font-medium tracking-tight text-foreground sm:text-2xl">
            The history of your system, made visible.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Features ───────────────────────────────────────────────────── */

const FEATURES = [
  {
    eyebrow: "Overview",
    title: "Health at a glance",
    body: "Commit velocity, module health, and debt trend in one quiet snapshot — every number derived from your repository data, never a placeholder.",
    mono: "commits/14d · debt trend",
  },
  {
    eyebrow: "Architecture",
    title: "Architecture you can feel",
    body: "A force-directed graph of your service mesh. Nodes settle slowly into place, colored by state — emerald for healthy, amber for evolving, rust for at risk.",
    mono: "api-gateway → control-plane",
  },
  {
    eyebrow: "Dependencies",
    title: "Every risky edge, flagged",
    body: "See which services pull on fragile dependencies — and why. Risky edges carry their reason, not just a red line.",
    mono: "worker → billing · risk: high",
  },
  {
    eyebrow: "Tech debt",
    title: "A registry that argues for you",
    body: "Ranked hotspots with risk scores and aging debt. The evidence an engineering leader needs to make the case for investment.",
    mono: "billing-retry-loop · risk 87",
  },
];

function Features() {
  return (
    <section id="features" className="border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-20">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title}>
            <div
              className={`grid items-center gap-6 md:grid-cols-2 ${
                i % 2 === 1 ? "md:[direction:rtl]" : ""
              }`}
            >
              <div className="md:[direction:ltr]">
                <p className="mb-2 text-xs uppercase tracking-widest text-muted">{f.eyebrow}</p>
                <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  {f.title}
                </h2>
                <p className="mt-3 max-w-md text-secondary">{f.body}</p>
              </div>
              <div className="md:[direction:ltr]">
                <div className="rounded-sm border border-border bg-surface px-4 py-6">
                  <p className="font-mono text-sm text-secondary">{f.mono}</p>
                  <div className="mt-4 h-1 w-24 rounded-full bg-border" />
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ── Workspace preview ──────────────────────────────────────────── */

function WorkspacePreview({ onOpenWorkspace }: { onOpenWorkspace: () => void }) {
  return (
    <section id="workspace" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <div className="rounded-sm border border-border bg-surface px-6 py-12 text-center sm:px-12">
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Try the workspace
            </h2>
            <p className="mx-auto mt-3 max-w-md text-secondary">
              Five screens — Overview, Architecture, Dependencies, Tech Debt,
              and History — running on realistic data for{" "}
              <span className="font-mono text-sm text-foreground">vertex/control-plane</span>.
            </p>
            <button
              type="button"
              onClick={onOpenWorkspace}
              className="mt-8 inline-flex cursor-pointer items-center gap-2 rounded-sm bg-foreground px-6 py-3 text-sm font-medium text-background transition-all duration-150 ease-out-soft hover:opacity-90 active:scale-95"
            >
              Open the workspace
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── History timeline (from demo commits) ──────────────────────── */

function HistoryTimeline() {
  const timeline = commits.slice(0, 5);
  return (
    <section id="history" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <p className="mb-2 text-xs uppercase tracking-widest text-muted">About</p>
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            A living history, not a snapshot
          </h2>
          <p className="mt-3 max-w-lg text-secondary">
            Every commit — a timeline of how your system evolved.
            Hashes and file paths, exactly as they were.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {timeline.map((c, i) => (
            <Reveal key={c.hash} delay={i * 40}>
              <div className="flex h-full flex-col rounded-sm border border-border bg-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-xs text-muted">{c.hash}</span>
                </div>
                <p className="text-sm text-foreground">{c.message}</p>
                <p className="mt-auto pt-3 font-mono text-[11px] text-muted">
                  {c.files[0]}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── CTA + footer ───────────────────────────────────────────────── */

function CtaFooter({ onOpenWorkspace }: { onOpenWorkspace: () => void }) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <Reveal>
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Ready to see your codebase?
          </h2>
          <button
            type="button"
            onClick={onOpenWorkspace}
            className="mt-8 inline-flex cursor-pointer items-center gap-2 rounded-sm bg-foreground px-6 py-3 text-sm font-medium text-background transition-all duration-150 ease-out-soft hover:opacity-90 active:scale-95"
          >
            Open the workspace
          </button>
        </div>
      </Reveal>
      <footer className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 text-xs text-muted sm:flex-row">
        <Brand />
        <nav aria-label="Footer" className="flex gap-5">
          <a href="#features" className="transition-colors hover:text-foreground">Product</a>
          <a href="#workspace" className="transition-colors hover:text-foreground">Workspace</a>
          <a href="#history" className="transition-colors hover:text-foreground">About</a>
        </nav>
        <p>&copy; {new Date().getFullYear()} Vertex</p>
      </footer>
    </section>
  );
}