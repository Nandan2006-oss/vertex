import { Moon, Sun } from "lucide-react";
import type { Theme } from "./useTheme";

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isLight = theme === "light";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isLight}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      title={isLight ? "Switch to dark theme" : "Switch to light theme"}
      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm text-secondary transition-all duration-150 ease-out-soft hover:bg-raised hover:text-foreground active:scale-95"
    >
      {isLight ? (
        <Moon aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
      ) : (
        <Sun aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
      )}
    </button>
  );
}
