interface EmptyStateProps {
  title: string;
  body?: string;
}

/**
 * Intentional empty state — never a blank space or bare "No results".
 * Explains why it's empty and what to do next. Icon-free, muted text.
 */
export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {body ? <p className="max-w-sm text-sm text-muted">{body}</p> : null}
    </div>
  );
}
