import { useEffect, useRef, useState } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import type {
  Service,
  ServiceState,
  Dependency,
} from "../analysis/types";

interface GraphNode extends SimulationNodeDatum {
  id: string;
  name: string;
  state: ServiceState;
  loc: number;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  risk: Dependency["risk"];
}

interface ArchitectureGraphProps {
  services: Service[];
  dependencies: Dependency[];
  /** Render height of the SVG area (px). Width fills the container. */
  height?: number;
  /** Show node labels (default true). Hero can disable them. */
  showLabels?: boolean;
  /** Enable hover/focus tooltips (default true). */
  interactive?: boolean;
  className?: string;
}

const STATE_COLOR: Record<ServiceState, string> = {
  healthy: "var(--color-emerald)",
  evolving: "var(--color-amber)",
  "at-risk": "var(--color-rust)",
};

const STATE_LABEL: Record<ServiceState, string> = {
  healthy: "Healthy",
  evolving: "Evolving",
  "at-risk": "At risk",
};

const NODE_R = 16;

/**
 * Shared animated architecture graph — SVG + d3-force with a slowed, damped
 * simulation for calm, deliberate motion. Node color = semantic state
 * (emerald / amber / rust). Reused by the Architecture screen and the
 * landing-page hero. Respects prefers-reduced-motion (renders settled layout).
 */
export function ArchitectureGraph({
  services,
  dependencies,
  height = 460,
  showLabels = true,
  interactive = true,
  className,
}: ArchitectureGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const linkRefs = useRef<(SVGLineElement | null)[]>([]);
  const nodeRefs = useRef<(SVGGElement | null)[]>([]);
  const labelRefs = useRef<(SVGTextElement | null)[]>([]);

  const [size, setSize] = useState({ width: 640, height });
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });

  /* ── Measure container width ── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize((s) => ({ ...s, width: el.clientWidth || s.width }));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── Build + run the simulation ── */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || services.length === 0) return;

    const nodes: GraphNode[] = services.map((s, i) => {
      const angle = (i / services.length) * Math.PI * 2 - Math.PI / 2;
      return {
        id: s.id,
        name: s.name,
        state: s.state,
        loc: s.loc,
        // Start on a circle so the settle is calm, not chaotic
        x: size.width / 2 + Math.cos(angle) * 130,
        y: size.height / 2 + Math.sin(angle) * 110,
      };
    });

    // Build ONE validated link collection — every link must have a valid
    // source AND target node. This same collection is used for D3 simulation,
    // SVG rendering, and event handling — never a second unvalidated array.
    const validatedLinks: GraphLink[] = dependencies
      .map((d) => ({ source: d.from, target: d.to, risk: d.risk }))
      .filter(
        (l) =>
          nodes.some((n) => n.id === (l.source as string)) &&
          nodes.some((n) => n.id === (l.target as string)),
      );

    const sim: Simulation<GraphNode, GraphLink> = forceSimulation(nodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(validatedLinks)
          .id((d) => d.id)
          .distance(120)
          .strength(0.6),
      )
      .force("charge", forceManyBody().strength(-360))
      .force("collide", forceCollide(NODE_R + 14))
      .force("center", forceCenter(size.width / 2, size.height / 2))
      .velocityDecay(0.85) // heavy damping → calm glide
      .alphaDecay(0.014); // slow, deliberate settle

    const render = () => {
      linkRefs.current.forEach((line, i) => {
        const l = validatedLinks[i] as GraphLink & {
          source: GraphNode;
          target: GraphNode;
        };
        if (!line) return;
        if (l.source.x == null || l.target.x == null) return;
        line.setAttribute("x1", String(l.source.x));
        line.setAttribute("y1", String(l.source.y));
        line.setAttribute("x2", String(l.target.x));
        line.setAttribute("y2", String(l.target.y));
      });
      nodeRefs.current.forEach((g, i) => {
        const n = nodes[i];
        if (!g) return;
        if (n.x == null || n.y == null) return;
        g.setAttribute(
          "transform",
          `translate(${n.x.toFixed(1)}, ${n.y.toFixed(1)})`,
        );
      });
    };

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReduced) {
      sim.stop();
      sim.tick(400); // settle statically — no animation
      render();
    } else {
      sim.on("tick", render);
      // Pause the simulation when the tab is hidden
      const onVisibility = () => {
        if (document.hidden) sim.stop();
        else sim.alpha(0.25).restart();
      };
      document.addEventListener("visibilitychange", onVisibility);
      return () => {
        sim.stop();
        document.removeEventListener("visibilitychange", onVisibility);
      };
    }

    return () => sim.stop();
  }, [services, dependencies, size.width, size.height]);

  /* ── Tooltip positioning (workspace screen only) ── */
  const placeTooltip = (node: GraphNode, g: SVGGElement) => {
    const bbox = g.getBoundingClientRect();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTipPos({
      x: bbox.left - rect.left + bbox.width / 2,
      y: bbox.top - rect.top - 8,
    });
    setHovered(node);
  };

  if (services.length === 0) {
    return (
      <div
        ref={containerRef}
        className={`flex items-center justify-center rounded-sm border border-border bg-surface ${className ?? ""}`}
        style={{ height }}
      >
        <p className="text-sm text-muted">No dependency relationships could be established.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <svg
        ref={svgRef}
        role="img"
        aria-label="Architecture graph: services colored by health state"
        viewBox={`0 0 ${size.width} ${size.height}`}
        className="block w-full"
        style={{ height }}
      >
        {/* Links — using validatedLinks that are also in the D3 sim */}
        {dependencies.map((d, i) => {
          const risky = d.risk === "high";
          const moderate = d.risk === "moderate";
          return (
            <line
              key={`${d.from}→${d.to}`}
              ref={(el) => {
                linkRefs.current[i] = el;
              }}
              stroke={
                risky
                  ? "var(--color-rust)"
                  : moderate
                    ? "var(--color-amber)"
                    : "var(--color-border)"
              }
              strokeWidth={risky ? 1.75 : 1.25}
              strokeDasharray={risky ? "5 4" : undefined}
              strokeOpacity={risky ? 0.85 : moderate ? 0.7 : 0.8}
            />
          );
        })}

        {/* Nodes */}
        {services.map((s, i) => (
          <g
            key={s.id}
            ref={(el) => {
              nodeRefs.current[i] = el;
            }}
            tabIndex={interactive ? 0 : undefined}
            role={interactive ? "img" : undefined}
            aria-label={`${s.name} — ${STATE_LABEL[s.state]} — ${s.loc.toLocaleString()} lines of code`}
            onMouseEnter={
              interactive
                ? (e) => placeTooltip(toNode(s, i), e.currentTarget)
                : undefined
            }
            onMouseLeave={interactive ? () => setHovered(null) : undefined}
            onFocus={
              interactive
                ? (e) => placeTooltip(toNode(s, i), e.currentTarget)
                : undefined
            }
            onBlur={interactive ? () => setHovered(null) : undefined}
            className={interactive ? "cursor-pointer" : undefined}
          >
            <circle
              r={NODE_R}
              fill={STATE_COLOR[s.state]}
              fillOpacity={0.12}
              stroke={STATE_COLOR[s.state]}
              strokeWidth={1.5}
            />
            <circle r={3.5} fill={STATE_COLOR[s.state]} />
            {showLabels && (
              <text
                ref={(el) => {
                  labelRefs.current[i] = el;
                }}
                y={NODE_R + 16}
                textAnchor="middle"
                className="font-mono"
                style={{ fill: "var(--color-secondary)", fontSize: 11 }}
              >
                {s.name}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Tooltip */}
      {interactive && hovered && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-sm border border-border bg-raised px-3 py-2 shadow-sm"
          style={{ left: tipPos.x, top: tipPos.y }}
        >
          <div className="mb-1 flex items-center gap-2">
            <span className="font-mono text-xs text-foreground">
              {hovered.name}
            </span>
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: STATE_COLOR[hovered.state] }}
            />
          </div>
          <p className="text-[11px] text-secondary">{STATE_LABEL[hovered.state]}</p>
          <p className="font-mono text-[11px] text-muted">
            {hovered.loc.toLocaleString()} LOC
          </p>
        </div>
      )}
    </div>
  );
}

function toNode(service: Service, index: number): GraphNode {
  return {
    id: service.id,
    name: service.name,
    state: service.state,
    loc: service.loc,
    index,
  };
}
