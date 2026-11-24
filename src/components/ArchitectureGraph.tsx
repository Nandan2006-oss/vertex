import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Tag,
  Crosshair,
  Pause,
  Play,
} from "lucide-react";
import type { Service, ServiceState, Dependency } from "../analysis/types";

export interface ArchGraphNode extends SimulationNodeDatum {
  id: string;
  name: string;
  state: ServiceState;
  loc: number;
  radius: number;
  fanIn: number;
  fanOut: number;
  degree: number;
}

export interface ArchGraphLink extends SimulationLinkDatum<ArchGraphNode> {
  risk: Dependency["risk"];
  reason?: string;
}

interface ArchitectureGraphProps {
  services: Service[];
  dependencies: Dependency[];
  height?: number | string;
  selectedModuleId?: string | null;
  onSelectModule?: (moduleId: string | null) => void;
  searchQuery?: string;
  filterState?: "all" | ServiceState;
  isolateSelected?: boolean;
  onToggleIsolate?: () => void;
  interactive?: boolean;
  className?: string;
}

const STATE_COLORS: Record<ServiceState, { bg: string; border: string; text: string; glow: string }> = {
  healthy: {
    bg: "rgba(16, 185, 129, 0.16)",
    border: "#10b981",
    text: "#34d399",
    glow: "rgba(16, 185, 129, 0.4)",
  },
  evolving: {
    bg: "rgba(245, 158, 11, 0.16)",
    border: "#f59e0b",
    text: "#fbbf24",
    glow: "rgba(245, 158, 11, 0.4)",
  },
  "at-risk": {
    bg: "rgba(244, 63, 94, 0.18)",
    border: "#f43f5e",
    text: "#fb7185",
    glow: "rgba(244, 63, 94, 0.45)",
  },
};

export function ArchitectureGraph({
  services,
  dependencies,
  height = 580,
  selectedModuleId = null,
  onSelectModule,
  searchQuery = "",
  filterState = "all",
  isolateSelected = false,
  onToggleIsolate,
  className = "",
}: ArchitectureGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: typeof height === "number" ? height : 580 });
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  const [showLabels, setShowLabels] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // ResizeObserver for container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      setDimensions({
        width: el.clientWidth || 800,
        height: el.clientHeight || (typeof height === "number" ? height : 580),
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  // Compute node degrees (fan-in, fan-out)
  const nodeDegrees = useMemo(() => {
    const inDeg = new Map<string, number>();
    const outDeg = new Map<string, number>();
    dependencies.forEach((d) => {
      outDeg.set(d.from, (outDeg.get(d.from) ?? 0) + 1);
      inDeg.set(d.to, (inDeg.get(d.to) ?? 0) + 1);
    });
    return { inDeg, outDeg };
  }, [dependencies]);

  // Build validated graph nodes
  const allNodes = useMemo<ArchGraphNode[]>(() => {
    return services.map((s, idx) => {
      const fanIn = nodeDegrees.inDeg.get(s.id) ?? 0;
      const fanOut = nodeDegrees.outDeg.get(s.id) ?? 0;
      const degree = fanIn + fanOut;
      // Radius scale based on LOC & degree
      const radius = Math.max(14, Math.min(32, Math.sqrt(Math.max(10, s.loc) / 80) + 12));

      // Circular initial layout
      const angle = (idx / Math.max(1, services.length)) * Math.PI * 2 - Math.PI / 2;
      const initDist = 180 + (idx % 2) * 50;

      return {
        id: s.id,
        name: s.name,
        state: s.state,
        loc: s.loc,
        radius,
        fanIn,
        fanOut,
        degree,
        x: dimensions.width / 2 + Math.cos(angle) * initDist,
        y: dimensions.height / 2 + Math.sin(angle) * initDist,
      };
    });
  }, [services, nodeDegrees, dimensions]);

  // Selected neighbors (for isolation mode)
  const connectedNodeIds = useMemo(() => {
    if (!selectedModuleId) return new Set<string>();
    const set = new Set<string>([selectedModuleId]);
    dependencies.forEach((d) => {
      if (d.from === selectedModuleId) set.add(d.to);
      if (d.to === selectedModuleId) set.add(d.from);
    });
    return set;
  }, [selectedModuleId, dependencies]);

  // Filtered nodes
  const activeNodes = useMemo(() => {
    return allNodes.filter((node) => {
      if (filterState !== "all" && node.state !== filterState) return false;
      if (isolateSelected && selectedModuleId && !connectedNodeIds.has(node.id)) return false;
      return true;
    });
  }, [allNodes, filterState, isolateSelected, selectedModuleId, connectedNodeIds]);

  const activeNodeIds = useMemo(() => new Set(activeNodes.map((n) => n.id)), [activeNodes]);

  // Validated links
  const activeLinks = useMemo<ArchGraphLink[]>(() => {
    return dependencies
      .filter((d) => activeNodeIds.has(d.from) && activeNodeIds.has(d.to))
      .map((d) => ({
        source: d.from,
        target: d.to,
        risk: d.risk,
        reason: d.reason,
      }));
  }, [dependencies, activeNodeIds]);

  // D3 Force Simulation
  const simRef = useRef<Simulation<ArchGraphNode, ArchGraphLink> | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (activeNodes.length === 0) return;

    const sim = forceSimulation<ArchGraphNode, ArchGraphLink>(activeNodes)
      .force(
        "link",
        forceLink<ArchGraphNode, ArchGraphLink>(activeLinks)
          .id((d) => d.id)
          .distance((l) => (l.risk === "high" ? 110 : 135))
          .strength(0.5),
      )
      .force("charge", forceManyBody().strength(-380).distanceMax(550))
      .force(
        "collide",
        forceCollide<ArchGraphNode>().radius((d) => d.radius + 18),
      )
      .force("center", forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.25))
      .force("x", forceX(dimensions.width / 2).strength(0.06))
      .force("y", forceY(dimensions.height / 2).strength(0.06))
      .velocityDecay(0.75)
      .alphaDecay(0.018);

    sim.on("tick", () => setTick((t) => t + 1));
    simRef.current = sim;

    if (isPaused) {
      sim.stop();
    }

    return () => {
      sim.stop();
    };
  }, [activeNodes, activeLinks, dimensions, isPaused]);

  // Pan & Zoom controls
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.88;
    setTransform((prev) => {
      const newK = Math.max(0.25, Math.min(3.5, prev.k * factor));
      // Zoom centered on cursor
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { ...prev, k: newK };
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const newX = mouseX - (mouseX - prev.x) * (newK / prev.k);
      const newY = mouseY - (mouseY - prev.y) * (newK / prev.k);
      return { x: newX, y: newY, k: newK };
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      tx: transform.x,
      ty: transform.y,
    };
  }, [transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setTransform((prev) => ({
      ...prev,
      x: panStartRef.current.tx + dx,
      y: panStartRef.current.ty + dy,
    }));
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const resetView = useCallback(() => {
    setTransform({ x: 0, y: 0, k: 1 });
  }, []);

  const zoomIn = useCallback(() => {
    setTransform((prev) => ({ ...prev, k: Math.min(3.5, prev.k * 1.25) }));
  }, []);

  const zoomOut = useCallback(() => {
    setTransform((prev) => ({ ...prev, k: Math.max(0.25, prev.k * 0.8) }));
  }, []);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      if (prev) {
        simRef.current?.alpha(0.3).restart();
      } else {
        simRef.current?.stop();
      }
      return !prev;
    });
  }, []);

  // Matching search node set
  const searchMatchedIds = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    const set = new Set<string>();
    activeNodes.forEach((n) => {
      if (n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) {
        set.add(n.id);
      }
    });
    return set;
  }, [searchQuery, activeNodes]);

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col overflow-hidden rounded-md border border-border bg-surface select-none shadow-2xs ${className}`}
      style={{ height }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Floating Canvas Controls Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1 rounded-sm border border-border/80 bg-surface/90 backdrop-blur-xs p-1 shadow-md">
        <button
          type="button"
          onClick={zoomIn}
          title="Zoom In"
          className="cursor-pointer rounded-xs p-1.5 text-secondary hover:bg-raised hover:text-foreground transition-colors"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={zoomOut}
          title="Zoom Out"
          className="cursor-pointer rounded-xs p-1.5 text-secondary hover:bg-raised hover:text-foreground transition-colors"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={resetView}
          title="Reset Zoom & Center View"
          className="cursor-pointer rounded-xs p-1.5 text-secondary hover:bg-raised hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <div className="h-3.5 w-[1px] bg-border my-auto mx-0.5" />
        <button
          type="button"
          onClick={() => setShowLabels((prev) => !prev)}
          title={showLabels ? "Hide Node Labels" : "Show Node Labels"}
          className={`cursor-pointer rounded-xs p-1.5 transition-colors ${
            showLabels ? "bg-accent/20 text-accent font-medium" : "text-secondary hover:bg-raised"
          }`}
        >
          <Tag className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={togglePause}
          title={isPaused ? "Resume Simulation" : "Freeze Simulation"}
          className={`cursor-pointer rounded-xs p-1.5 transition-colors ${
            isPaused ? "bg-amber/20 text-amber" : "text-secondary hover:bg-raised"
          }`}
        >
          {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        </button>
        {selectedModuleId && onToggleIsolate && (
          <button
            type="button"
            onClick={onToggleIsolate}
            title={isolateSelected ? "Show All Modules" : "Isolate Selected Module & Connections"}
            className={`cursor-pointer rounded-xs p-1.5 transition-colors ${
              isolateSelected ? "bg-accent text-white font-medium" : "text-secondary hover:bg-raised"
            }`}
          >
            <Crosshair className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Floating Canvas Legend & Graph Status (Bottom-Left) */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-3 rounded-sm border border-border/70 bg-surface/85 backdrop-blur-xs px-2.5 py-1.5 text-[11px] shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald" />
          <span className="text-secondary font-medium">Healthy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber" />
          <span className="text-secondary font-medium">Evolving</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rust" />
          <span className="text-secondary font-medium">At Risk</span>
        </div>
        <div className="h-3 w-[1px] bg-border" />
        <span className="font-mono text-muted text-[10px]">
          {activeNodes.length} nodes · {activeLinks.length} edges
        </span>
      </div>

      {/* SVG Interactive Canvas */}
      <svg
        role="img"
        aria-label="Architecture graph: interactive force simulation of module dependencies"
        className="h-full w-full cursor-grab active:cursor-grabbing block"
      >
        <defs>
          {/* Arrowhead markers */}
          <marker
            id="arch-arrow-default"
            viewBox="0 0 10 10"
            refX="22"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--color-border)" opacity="0.8" />
          </marker>
          <marker
            id="arch-arrow-accent"
            viewBox="0 0 10 10"
            refX="22"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--color-accent)" />
          </marker>
          <marker
            id="arch-arrow-rust"
            viewBox="0 0 10 10"
            refX="22"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--color-rust)" />
          </marker>
        </defs>

        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {/* Dependency Links */}
          {activeLinks.map((link, i) => {
            const src = link.source as ArchGraphNode;
            const tgt = link.target as ArchGraphNode;
            if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) return null;

            const isRelatedToSelected =
              selectedModuleId && (src.id === selectedModuleId || tgt.id === selectedModuleId);
            const isRelatedToHover =
              hoveredNodeId && (src.id === hoveredNodeId || tgt.id === hoveredNodeId);
            const isHighRisk = link.risk === "high";

            let strokeColor = "var(--color-border)";
            let strokeWidth = 1.25;
            let strokeOpacity = 0.55;
            let marker = "url(#arch-arrow-default)";

            if (isRelatedToSelected || isRelatedToHover) {
              strokeColor = "var(--color-accent)";
              strokeWidth = 2.2;
              strokeOpacity = 0.95;
              marker = "url(#arch-arrow-accent)";
            } else if (isHighRisk) {
              strokeColor = "var(--color-rust)";
              strokeWidth = 1.75;
              strokeOpacity = 0.85;
              marker = "url(#arch-arrow-rust)";
            }

            return (
              <line
                key={`link-${src.id}-${tgt.id}-${i}`}
                x1={src.x}
                y1={src.y}
                x2={tgt.x}
                y2={tgt.y}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeDasharray={isHighRisk ? "4 3" : undefined}
                markerEnd={marker}
              />
            );
          })}

          {/* Module Nodes */}
          {activeNodes.map((node) => {
            if (node.x == null || node.y == null) return null;

            const isSelected = selectedModuleId === node.id;
            const isHovered = hoveredNodeId === node.id;
            const isConnected = selectedModuleId ? connectedNodeIds.has(node.id) : true;
            const isSearchMatched = searchMatchedIds ? searchMatchedIds.has(node.id) : true;

            const colorStyle = STATE_COLORS[node.state];
            const opacity =
              (selectedModuleId && !isConnected) || (searchMatchedIds && !isSearchMatched)
                ? 0.22
                : 1;

            return (
              <g
                key={`node-${node.id}`}
                transform={`translate(${node.x}, ${node.y})`}
                opacity={opacity}
                className="cursor-pointer transition-opacity duration-150"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectModule?.(isSelected ? null : node.id);
                }}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                {/* Glow ring for selected or search matched */}
                {(isSelected || isSearchMatched) && (
                  <circle
                    r={node.radius + 7}
                    fill="none"
                    stroke={isSelected ? "var(--color-accent)" : colorStyle.border}
                    strokeWidth={isSelected ? 3 : 1.5}
                    strokeOpacity={0.8}
                    className="animate-pulse"
                  />
                )}

                {/* Outer Node Body */}
                <circle
                  r={node.radius}
                  fill={isSelected ? "var(--color-accent)" : colorStyle.bg}
                  stroke={isSelected ? "var(--color-accent)" : colorStyle.border}
                  strokeWidth={isSelected ? 2.5 : 1.75}
                  filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
                />

                {/* Center Core Dot */}
                <circle
                  r={Math.max(3, node.radius * 0.24)}
                  fill={isSelected ? "#ffffff" : colorStyle.border}
                />

                {/* Node Degree Counter if hub */}
                {node.degree > 2 && (
                  <text
                    y={3.5}
                    textAnchor="middle"
                    className="font-mono font-bold pointer-events-none select-none"
                    style={{
                      fill: isSelected ? "#ffffff" : colorStyle.text,
                      fontSize: 9,
                    }}
                  >
                    {node.degree}
                  </text>
                )}

                {/* Label */}
                {showLabels && (
                  <text
                    y={node.radius + 15}
                    textAnchor="middle"
                    className="font-mono pointer-events-none select-none font-medium"
                    style={{
                      fill: isSelected
                        ? "var(--color-foreground)"
                        : isHovered
                          ? "var(--color-foreground)"
                          : "var(--color-secondary)",
                      fontSize: 11,
                      textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                    }}
                  >
                    {node.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
