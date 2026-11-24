import { useState } from "react";
import { ArrowRight, AlertTriangle } from "lucide-react";

export interface CircularDepItem {
  cycle: string[];
}

interface CircularDependencyGraphProps {
  cycles: CircularDepItem[];
  className?: string;
  onSelectFile?: (filePath: string) => void;
}

function getBasename(path: string): string {
  const lastSlash = path.lastIndexOf("/");
  return lastSlash === -1 ? path : path.slice(lastSlash + 1);
}

export function CircularDependencyGraph({
  cycles,
  className = "",
  onSelectFile,
}: CircularDependencyGraphProps) {
  const [activeCycleIdx, setActiveCycleIdx] = useState(0);

  if (cycles.length === 0) return null;

  const activeCycle = cycles[activeCycleIdx] || cycles[0];
  const nodes = activeCycle.cycle;
  const count = nodes.length;

  // Geometry for circular layout
  const size = 380;
  const center = size / 2;
  const radius = Math.min(135, Math.max(75, count * 30));

  // Compute node coordinates along circle
  const nodeCoords = nodes.map((file, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return {
      file,
      name: getBasename(file),
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
    };
  });

  return (
    <div className={`flex flex-col gap-4 rounded-md border border-rust/40 bg-surface/90 p-5 shadow-lg ${className}`}>
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-xs bg-rust/15 text-rust border border-rust/30">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">
              {cycles.length} Circular Reference Chain{cycles.length === 1 ? "" : "s"} Detected
            </h3>
            <p className="text-[11px] text-muted">
              Cycles cause initialization order bugs, bundler chunk fragmentation & memory leaks.
            </p>
          </div>
        </div>

        {/* Cycle selector buttons if multiple */}
        {cycles.length > 1 && (
          <div className="flex items-center gap-1.5">
            {cycles.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveCycleIdx(i)}
                className={`cursor-pointer rounded-xs px-2.5 py-1 text-xs font-mono transition-all ${
                  activeCycleIdx === i
                    ? "bg-rust text-white font-bold shadow-2xs"
                    : "border border-border bg-raised/50 text-muted hover:text-foreground"
                }`}
              >
                Loop {i + 1} ({c.cycle.length} files)
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Graphical Ring Diagram */}
      <div className="flex flex-col items-center justify-center p-2">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full max-w-[380px] h-auto overflow-visible select-none"
        >
          <defs>
            <marker
              id="cycle-arrow"
              viewBox="0 -5 10 10"
              refX="10"
              refY="0"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0,-4L9,0L0,4" fill="var(--color-rust)" />
            </marker>
          </defs>

          {/* Central Loop Glow Indicator */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--color-rust-muted)"
            strokeWidth={24}
          />

          {/* Directed Links between sequential nodes in cycle */}
          {nodeCoords.map((cur, i) => {
            const next = nodeCoords[(i + 1) % count];
            const dx = next.x - cur.x;
            const dy = next.y - cur.y;
            const dist = Math.hypot(dx, dy) || 1;

            const startX = cur.x + (dx / dist) * 18;
            const startY = cur.y + (dy / dist) * 18;
            const endX = next.x - (dx / dist) * 22;
            const endY = next.y - (dy / dist) * 22;

            // Slight curve for circular flow
            const midX = (cur.x + next.x) / 2 + (cur.y - next.y) * 0.15;
            const midY = (cur.y + next.y) / 2 + (next.x - cur.x) * 0.15;

            return (
              <path
                key={i}
                d={`M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`}
                fill="none"
                stroke="var(--color-rust)"
                strokeWidth={2.2}
                markerEnd="url(#cycle-arrow)"
                strokeDasharray="4 3"
              />
            );
          })}

          {/* Nodes */}
          {nodeCoords.map((node, i) => (
            <g
              key={i}
              transform={`translate(${node.x}, ${node.y})`}
              className="cursor-pointer"
              onClick={() => onSelectFile?.(node.file)}
            >
              <circle
                r={17}
                fill="var(--color-surface)"
                stroke="var(--color-rust)"
                strokeWidth={2}
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.4))"
              />
              <circle r={4.5} fill="var(--color-rust)" />
              <text
                y={28}
                textAnchor="middle"
                className="font-mono text-[11px] font-bold"
                fill="var(--color-foreground)"
              >
                {node.name}
              </text>
            </g>
          ))}
        </svg>

        {/* Cycle Step by Step Chain */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs">
          {nodes.map((file, i) => (
            <div key={i} className="flex items-center gap-1.5 font-mono">
              <button
                type="button"
                onClick={() => onSelectFile?.(file)}
                title={file}
                className="cursor-pointer rounded-xs bg-rust/15 border border-rust/40 px-2.5 py-1 text-rust font-bold hover:bg-rust/25 transition-colors"
              >
                {getBasename(file)}
              </button>
              <ArrowRight className="h-3.5 w-3.5 text-rust/70" />
            </div>
          ))}
          <span className="rounded-xs bg-rust/15 border border-rust/40 px-2.5 py-1 text-rust font-bold font-mono">
            {getBasename(nodes[0])}
          </span>
        </div>
      </div>
    </div>
  );
}
