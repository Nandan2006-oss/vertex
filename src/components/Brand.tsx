interface VertexMarkProps {
  className?: string;
}

/**
 * Vertex brand mark — a node where edges converge. Geometric, neutral,
 * deliberately NOT an AI sparkle. Renders in currentColor so it adapts.
 */
export function VertexMark({ className }: VertexMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* three edges converging at the node */}
      <path
        d="M5.9 8.6 L12 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M18.1 8.6 L12 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 19 L12 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* the node itself */}
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );
}

interface BrandProps {
  className?: string;
  markClassName?: string;
  /** When true, renders as a <button> — used in workspace top bar to navigate back */
  interactive?: boolean;
  /** Called when the interactive brand is activated */
  onActivate?: () => void;
}

export function Brand({ className, markClassName, interactive, onActivate }: BrandProps) {
  const inner = (
    <>
      <VertexMark className={`h-6 w-6 ${markClassName ?? ""}`} />
      <span className="font-display text-lg font-bold tracking-tight text-foreground">
        Vertex
      </span>
    </>
  );

  if (interactive && onActivate) {
    return (
      <button
        type="button"
        onClick={onActivate}
        className={`inline-flex cursor-pointer items-center gap-2 transition-opacity hover:opacity-80 active:scale-95 ${className ?? ""}`}
        aria-label="Back to landing"
      >
        {inner}
      </button>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      {inner}
    </span>
  );
}
