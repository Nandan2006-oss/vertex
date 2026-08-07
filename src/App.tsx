import { useState } from "react";
import { useTheme } from "./theme/useTheme";
import { LandingPage } from "./landing/LandingPage";
import { WorkspaceShell } from "./workspace/WorkspaceShell";

type View = "landing" | "workspace";

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<View>("landing");

  if (view === "workspace") {
    return (
      <WorkspaceShell
        theme={theme}
        onToggleTheme={toggleTheme}
        onExit={() => setView("landing")}
      />
    );
  }

  return (
    <LandingPage
      theme={theme}
      onToggleTheme={toggleTheme}
      onOpenWorkspace={() => setView("workspace")}
    />
  );
}