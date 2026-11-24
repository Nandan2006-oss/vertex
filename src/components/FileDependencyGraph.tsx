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
  Maximize2,
  RotateCcw,
  FileCode,
  ArrowRight,
  X,
  Layers,
} from "lucide-react";

export interface FileDependency {
  from: string;
  to: string;
  evidence: string;
}

interface GraphNode extends SimulationNodeDatum {
  id: string;
  name: string;
  dir: string;
  inDegree: number;
  outDegree: number;
  degree: number;
  radius: number;
  color: {
    bg: string;
    border: string;
    text: string;
    glow: string;
  };
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  evidence: string;
}

interface FileDependencyGraphProps {
  dependencies: FileDependency[];
  searchQuery?: string;
  height?: number;
  className?: string;
}

const DIR_PALETTE = [
  { bg: "rgba(16, 185, 129, 0.14)", border: "#10b981", text: "#10b981", glow: "rgba(16, 185, 129, 0.35)" }, // Emerald
  { bg: "rgba(6, 182, 212, 0.14)", border: "#06b6d4", text: "#06b6d4", glow: "rgba(6, 182, 212, 0.35)" },   // Cyan
  { bg: "rgba(139, 92, 246, 0.14)", border: "#a78bfa", text: "#c4b5fd", glow: "rgba(139, 92, 246, 0.35)" }, // Violet
  { bg: "rgba(245, 158, 11, 0.14)", border: "#f59e0b", text: "#fbbf24", glow: "rgba(245, 158, 11, 0.35)" }, // Amber
  { bg: "rgba(244, 63, 94, 0.14)", border: "#f43f5e", text: "#fb7185", glow: "rgba(244, 63, 94, 0.35)" },   // Rose
  { bg: "rgba(99, 102, 241, 0.14)", border: "#818cf8", text: "#a5b4fc", glow: "rgba(99, 102, 241, 0.35)" }, // Indigo
  { bg: "rgba(20, 184, 166, 0.14)", border: "#2dd4bf", text: "#5eead4", glow: "rgba(20, 184, 166, 0.35)" }, // Teal
  { bg: "rgba(236, 72, 153, 0.14)", border: "#f472b6", text: "#f9a8d4", glow: "rgba(236, 72, 153, 0.35)" }, // Pink
  { bg: "rgba(148, 163, 184, 0.14)", border: "#94a3b8", text: "#cbd5e1", glow: "rgba(148, 163, 184, 0.3)" },// Slate / Root
];

function getDirectory(path: string): string {
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash === -1) return "root";
  return path.slice(0, lastSlash);
}

function getBasename(path: string): string {
  const lastSlash = path.lastIndexOf("/");
  return lastSlash === -1 ? path : path.slice(lastSlash + 1);
}

export function FileDependencyGraph({
  dependencies,
  searchQuery = "",
  height = 540,
  className = "",
}: FileDependencyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height });

  // Transform for pan & zoom
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  // Dragging node state
  const draggingNodeRef = useRef<GraphNode | null>(null);

  // Hover and selection
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedDir, setSelectedDir] = useState<string | null>(null);

  // Tooltip
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: React.ReactNode;
  } | null>(null);

  // Re-render trigger from D3 ticks
  const [, setTickCount] = useState(0);

  // ResizeObserver for responsive width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      setDimensions({
        width: Math.max(300, el.clientWidth || 800),
        height: Math.max(300, height),
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  // Derive unique nodes, degrees, and directory map
  const { initialNodes, initialLinks, directories } = useMemo(() => {
    const nodeMap = new Map<
      string,
      { inDegree: number; outDegree: number; dir: string }
    >();

    const dirSet = new Set<string>();

    for (const dep of dependencies) {
      const fromDir = getDirectory(dep.from);
      const toDir = getDirectory(dep.to);
      dirSet.add(fromDir);
      dirSet.add(toDir);

      if (!nodeMap.has(dep.from)) {
        nodeMap.set(dep.from, { inDegree: 0, outDegree: 0, dir: fromDir });
      }
      if (!nodeMap.has(dep.to)) {
        nodeMap.set(dep.to, { inDegree: 0, outDegree: 0, dir: toDir });
      }

      nodeMap.get(dep.from)!.outDegree += 1;
      nodeMap.get(dep.to)!.inDegree += 1;
    }

    const sortedDirs = Array.from(dirSet).sort();
    const dirColorMap = new Map<string, (typeof DIR_PALETTE)[number]>();
    sortedDirs.forEach((dir, i) => {
      dirColorMap.set(dir, DIR_PALETTE[i % DIR_PALETTE.length]);
    });

    const nodesList: GraphNode[] = [];
    const count = nodeMap.size;
    let idx = 0;

    nodeMap.forEach((meta, id) => {
      const totalDegree = meta.inDegree + meta.outDegree;
      const radius = Math.min(24, Math.max(13, 12 + Math.sqrt(totalDegree) * 2.8));
      const color = dirColorMap.get(meta.dir) ?? DIR_PALETTE[DIR_PALETTE.length - 1];

      // Distribute along circle initially for calm settle
      const angle = (idx / Math.max(1, count)) * Math.PI * 2;
      const dist = Math.min(220, 40 + count * 5);
      const cx = dimensions.width / 2 + Math.cos(angle) * dist;
      const cy = dimensions.height / 2 + Math.sin(angle) * dist;

      nodesList.push({
        id,
        name: getBasename(id),
        dir: meta.dir,
        inDegree: meta.inDegree,
        outDegree: meta.outDegree,
        degree: totalDegree,
        radius,
        color,
        x: cx,
        y: cy,
      });
      idx++;
    });

    const linksList: GraphLink[] = dependencies.map((d) => ({
      id: `${d.from}->${d.to}`,
      source: d.from,
      target: d.to,
      evidence: d.evidence,
    }));

    const dirsMeta = sortedDirs.map((dir) => {
      const dirNodes = nodesList.filter((n) => n.dir === dir);
      return {
        name: dir,
        count: dirNodes.length,
        color: dirColorMap.get(dir)!,
      };
    });

    return {
      initialNodes: nodesList,
      initialLinks: linksList,
      directories: dirsMeta,
    };
  }, [dependencies, dimensions.width, dimensions.height]);

  // Stable references for D3 simulation
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);

  // Initialize and run D3 force simulation
  useEffect(() => {
    if (initialNodes.length === 0) return;

    // Deep clone nodes and links so simulation maintains coordinates
    const nodes = initialNodes.map((n) => ({ ...n }));
    const nodeIds = new Set(nodes.map((n) => n.id));

    const links = initialLinks
      .filter((l) => nodeIds.has(l.source as string) && nodeIds.has(l.target as string))
      .map((l) => ({ ...l }));

    nodesRef.current = nodes;
    linksRef.current = links;

    const sim = forceSimulation<GraphNode, GraphLink>(nodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((l) => {
            const src = l.source as GraphNode;
            const tgt = l.target as GraphNode;
            const extra = (src.radius || 15) + (tgt.radius || 15);
            return 80 + extra;
          })
          .strength(0.55),
      )
      .force("charge", forceManyBody().strength(-240))
      .force(
        "collide",
        forceCollide<GraphNode>((d) => d.radius + 16),
      )
      .force("center", forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.08))
      .force("x", forceX(dimensions.width / 2).strength(0.03))
      .force("y", forceY(dimensions.height / 2).strength(0.03))
      .velocityDecay(0.65)
      .alphaDecay(0.022);

    sim.on("tick", () => {
      setTickCount((t) => t + 1);
    });

    simRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [initialNodes, initialLinks, dimensions.width, dimensions.height]);

  // Fit graph to viewport
  const fitView = useCallback(() => {
    const nodes = nodesRef.current;
    if (nodes.length === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const n of nodes) {
      if (n.x == null || n.y == null) continue;
      minX = Math.min(minX, n.x - n.radius - 20);
      maxX = Math.max(maxX, n.x + n.radius + 20);
      minY = Math.min(minY, n.y - n.radius - 20);
      maxY = Math.max(maxY, n.y + n.radius + 20);
    }

    const graphWidth = maxX - minX || 1;
    const graphHeight = maxY - minY || 1;
    const padding = 50;

    const scaleX = (dimensions.width - padding * 2) / graphWidth;
    const scaleY = (dimensions.height - padding * 2) / graphHeight;
    const k = Math.min(1.8, Math.max(0.3, Math.min(scaleX, scaleY)));

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const x = dimensions.width / 2 - cx * k;
    const y = dimensions.height / 2 - cy * k;

    setTransform({ x, y, k });
  }, [dimensions.width, dimensions.height]);

  // Initial fit once nodes are laid out
  useEffect(() => {
    const t = setTimeout(() => {
      fitView();
    }, 280);
    return () => clearTimeout(t);
  }, [fitView]);

  // Zoom controls
  const handleZoom = (direction: "in" | "out") => {
    setTransform((prev) => {
      const factor = direction === "in" ? 1.25 : 0.8;
      const newK = Math.min(3.5, Math.max(0.2, prev.k * factor));
      // Zoom from center
      const cx = dimensions.width / 2;
      const cy = dimensions.height / 2;
      const newX = cx - (cx - prev.x) * (newK / prev.k);
      const newY = cy - (cy - prev.y) * (newK / prev.k);
      return { x: newX, y: newY, k: newK };
    });
  };

  const handleReset = () => {
    fitView();
    if (simRef.current) {
      simRef.current.alpha(0.3).restart();
    }
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Smooth, calibrated damping — comfortable and controlled
    const zoomIntensity = 0.0012;
    const factor = Math.exp(-e.deltaY * zoomIntensity);
    const clampedFactor = Math.min(1.06, Math.max(0.94, factor));
    setTransform((prev) => {
      const newK = Math.min(3.5, Math.max(0.2, prev.k * clampedFactor));
      const newX = mouseX - (mouseX - prev.x) * (newK / prev.k);
      const newY = mouseY - (mouseY - prev.y) * (newK / prev.k);
      return { x: newX, y: newY, k: newK };
    });
  };

  // Background drag to pan
  const handleMouseDownBg = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget && (e.target as HTMLElement).tagName !== "svg") {
      return;
    }
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      tx: transform.x,
      ty: transform.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Handle panning
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setTransform((prev) => ({
        ...prev,
        x: panStartRef.current.tx + dx,
        y: panStartRef.current.ty + dy,
      }));
      return;
    }

    // Handle node dragging
    if (draggingNodeRef.current && simRef.current) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Inverse transform to canvas space
      const canvasX = (mouseX - transform.x) / transform.k;
      const canvasY = (mouseY - transform.y) / transform.k;

      draggingNodeRef.current.fx = canvasX;
      draggingNodeRef.current.fy = canvasY;
      simRef.current.alpha(0.2).restart();
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }
    if (draggingNodeRef.current) {
      draggingNodeRef.current.fx = null;
      draggingNodeRef.current.fy = null;
      draggingNodeRef.current = null;
    }
  };

  // Node drag start
  const handleNodeDragStart = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation();
    draggingNodeRef.current = node;
    node.fx = node.x;
    node.fy = node.y;
    if (simRef.current) {
      simRef.current.alphaTarget(0.2).restart();
    }
  };

  // Determine active highlight neighborhood
  const activeFocusId = selectedNodeId || hoveredNodeId;

  const { connectedNodeIds, outboundEdgeIds, inboundEdgeIds } = useMemo(() => {
    if (!activeFocusId) {
      return {
        connectedNodeIds: new Set<string>(),
        outboundEdgeIds: new Set<string>(),
        inboundEdgeIds: new Set<string>(),
      };
    }

    const connected = new Set<string>([activeFocusId]);
    const outbound = new Set<string>();
    const inbound = new Set<string>();

    for (const link of linksRef.current) {
      const srcId = typeof link.source === "object" ? link.source.id : link.source;
      const tgtId = typeof link.target === "object" ? link.target.id : link.target;

      if (srcId === activeFocusId) {
        connected.add(tgtId);
        outbound.add(link.id);
      }
      if (tgtId === activeFocusId) {
        connected.add(srcId);
        inbound.add(link.id);
      }
    }

    return {
      connectedNodeIds: connected,
      outboundEdgeIds: outbound,
      inboundEdgeIds: inbound,
    };
  }, [activeFocusId]);

  // Selected node detailed inspect data
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodesRef.current.find((n) => n.id === selectedNodeId) ?? null;
  }, [selectedNodeId]);

  const selectedNodeImports = useMemo(() => {
    if (!selectedNodeId) return [];
    return dependencies.filter((d) => d.from === selectedNodeId);
  }, [selectedNodeId, dependencies]);

  const selectedNodeDependents = useMemo(() => {
    if (!selectedNodeId) return [];
    return dependencies.filter((d) => d.to === selectedNodeId);
  }, [selectedNodeId, dependencies]);

  // Search filter matching
  const matchingNodeIds = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    const set = new Set<string>();
    for (const n of nodesRef.current) {
      if (n.id.toLowerCase().includes(q) || n.name.toLowerCase().includes(q)) {
        set.add(n.id);
      }
    }
    return set;
  }, [searchQuery]);

  const nodes = nodesRef.current;
  const links = linksRef.current;

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col rounded-sm border border-border bg-surface select-none overflow-hidden ${className}`}
      style={{ height }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDownBg}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top Header / Legend / Directory Bar */}
      <div className="z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Layers className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            <span>Directories:</span>
          </span>
          <button
            type="button"
            onClick={() => setSelectedDir(null)}
            className={`cursor-pointer rounded-sm px-2 py-0.5 text-xs font-mono transition-colors ${
              selectedDir === null
                ? "bg-raised font-medium text-foreground border border-border"
                : "text-muted hover:text-secondary"
            }`}
          >
            All ({nodes.length})
          </button>
          {directories.slice(0, 7).map((dir) => {
            const isSelected = selectedDir === dir.name;
            return (
              <button
                key={dir.name}
                type="button"
                onClick={() => setSelectedDir(isSelected ? null : dir.name)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs transition-colors ${
                  isSelected
                    ? "bg-raised font-medium text-foreground border border-border"
                    : "text-muted hover:text-secondary"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: dir.color.border }}
                  aria-hidden="true"
                />
                <span className="font-mono text-[11px] truncate max-w-[120px]">
                  {dir.name}
                </span>
                <span className="text-[10px] text-muted">({dir.count})</span>
              </button>
            );
          })}
        </div>

        {/* Legend for Edges */}
        <div className="hidden sm:flex items-center gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 bg-amber" />
            <span>Imports (Outbound)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 bg-emerald" />
            <span>Imported By (Inbound)</span>
          </span>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <svg
        className={`w-full flex-1 block ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      >
        <defs>
          {/* Default Edge Arrow Marker */}
          <marker
            id="dep-arrow-default"
            viewBox="0 -5 10 10"
            refX="8"
            refY="0"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M0,-4L8,0L0,4" fill="var(--color-border)" />
          </marker>

          {/* Outbound Arrow Marker (Amber) */}
          <marker
            id="dep-arrow-outbound"
            viewBox="0 -5 10 10"
            refX="8"
            refY="0"
            markerWidth="5.5"
            markerHeight="5.5"
            orient="auto"
          >
            <path d="M0,-4L8,0L0,4" fill="#f59e0b" />
          </marker>

          {/* Inbound Arrow Marker (Emerald) */}
          <marker
            id="dep-arrow-inbound"
            viewBox="0 -5 10 10"
            refX="8"
            refY="0"
            markerWidth="5.5"
            markerHeight="5.5"
            orient="auto"
          >
            <path d="M0,-4L8,0L0,4" fill="#10b981" />
          </marker>
        </defs>

        {/* Viewport Transform Group */}
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {/* Links / Edges */}
          {links.map((link) => {
            const src = typeof link.source === "object" ? link.source : null;
            const tgt = typeof link.target === "object" ? link.target : null;
            if (!src || !tgt || src.x == null || src.y == null || tgt.x == null || tgt.y == null) {
              return null;
            }

            const isOutbound = outboundEdgeIds.has(link.id);
            const isInbound = inboundEdgeIds.has(link.id);
            const isHoveredEdge = hoveredEdgeId === link.id;

            let isDimmed = false;
            if (activeFocusId) {
              isDimmed = !isOutbound && !isInbound;
            } else if (selectedDir) {
              isDimmed = src.dir !== selectedDir && tgt.dir !== selectedDir;
            } else if (matchingNodeIds) {
              isDimmed = !matchingNodeIds.has(src.id) && !matchingNodeIds.has(tgt.id);
            }

            // Calculate precise start and end at node boundaries for clean arrowheads
            const dx = tgt.x - src.x;
            const dy = tgt.y - src.y;
            const dist = Math.hypot(dx, dy) || 1;

            const startX = src.x + (dx / dist) * (src.radius + 2);
            const startY = src.y + (dy / dist) * (src.radius + 2);
            const endX = tgt.x - (dx / dist) * (tgt.radius + 5);
            const endY = tgt.y - (dy / dist) * (tgt.radius + 5);

            const strokeColor = isOutbound
              ? "#f59e0b"
              : isInbound
                ? "#10b981"
                : isHoveredEdge
                  ? "var(--color-foreground)"
                  : "var(--color-border)";

            const strokeWidth = isOutbound || isInbound || isHoveredEdge ? 2.2 : 1.15;
            const markerId = isOutbound
              ? "url(#dep-arrow-outbound)"
              : isInbound
                ? "url(#dep-arrow-inbound)"
                : "url(#dep-arrow-default)";

            return (
              <g key={link.id}>
                {/* Thick invisible hover target */}
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke="transparent"
                  strokeWidth={14}
                  className="cursor-pointer"
                  onMouseEnter={(e) => {
                    setHoveredEdgeId(link.id);
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    setTooltip({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top - 12,
                      content: (
                        <div className="flex flex-col gap-1 max-w-sm">
                          <div className="flex items-center gap-1.5 text-xs text-foreground font-mono">
                            <span className="truncate max-w-[140px]">{src.name}</span>
                            <ArrowRight className="h-3 w-3 shrink-0 text-amber" />
                            <span className="truncate max-w-[140px]">{tgt.name}</span>
                          </div>
                          <p className="font-mono text-[10px] text-muted border-t border-border pt-1">
                            {link.evidence}
                          </p>
                        </div>
                      ),
                    });
                  }}
                  onMouseLeave={() => {
                    setHoveredEdgeId(null);
                    setTooltip(null);
                  }}
                />
                {/* Visible line */}
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeOpacity={isDimmed ? 0.08 : isOutbound || isInbound ? 0.95 : 0.65}
                  strokeDasharray={isOutbound || isInbound ? undefined : undefined}
                  markerEnd={isDimmed ? undefined : markerId}
                  className="transition-[stroke-opacity,stroke-width] duration-150 pointer-events-none"
                />
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            if (node.x == null || node.y == null) return null;

            const isSelected = selectedNodeId === node.id;
            const isHovered = hoveredNodeId === node.id;
            const isFocused = activeFocusId === node.id;
            const isConnected = connectedNodeIds.has(node.id);

            let isDimmed = false;
            if (activeFocusId) {
              isDimmed = !isFocused && !isConnected;
            } else if (selectedDir) {
              isDimmed = node.dir !== selectedDir;
            } else if (matchingNodeIds) {
              isDimmed = !matchingNodeIds.has(node.id);
            }

            const isSearchMatch = matchingNodeIds?.has(node.id) ?? false;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x.toFixed(1)}, ${node.y.toFixed(1)})`}
                className="cursor-pointer"
                opacity={isDimmed ? 0.15 : 1}
                onMouseDown={(e) => handleNodeDragStart(e, node)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
                }}
                onMouseEnter={(e) => {
                  setHoveredNodeId(node.id);
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTooltip({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top - 12,
                    content: (
                      <div className="flex flex-col gap-1 min-w-[160px]">
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {node.name}
                        </span>
                        <span className="font-mono text-[10px] text-muted">
                          {node.id}
                        </span>
                        <div className="mt-1 flex items-center justify-between border-t border-border pt-1 text-[11px]">
                          <span className="text-amber">Imports: {node.outDegree}</span>
                          <span className="text-emerald">Imported by: {node.inDegree}</span>
                        </div>
                      </div>
                    ),
                  });
                }}
                onMouseLeave={() => {
                  setHoveredNodeId(null);
                  setTooltip(null);
                }}
              >
                {/* Glow ring for selected / search match / focused */}
                {(isSelected || isFocused || isSearchMatch) && (
                  <circle
                    r={node.radius + 6}
                    fill="none"
                    stroke={isSelected ? node.color.border : "#f59e0b"}
                    strokeWidth={isSelected ? 3 : 2}
                    strokeDasharray={isSearchMatch && !isSelected ? "3 3" : undefined}
                    className="animate-pulse"
                  />
                )}

                {/* Outer halo */}
                <circle
                  r={node.radius}
                  fill={node.color.bg}
                  stroke={node.color.border}
                  strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.25}
                />

                {/* Inner center dot */}
                <circle
                  r={Math.max(3, node.radius * 0.28)}
                  fill={node.color.border}
                />

                {/* Node Degree Badge (when node has multiple connections) */}
                {node.degree > 1 && (
                  <g transform={`translate(${node.radius - 2}, ${-node.radius + 2})`}>
                    <circle r={7} fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth={1} />
                    <text
                      y={3}
                      textAnchor="middle"
                      className="font-mono font-bold"
                      style={{ fontSize: 8, fill: "var(--color-secondary)" }}
                    >
                      {node.degree}
                    </text>
                  </g>
                )}

                {/* Text Label */}
                <text
                  y={node.radius + 14}
                  textAnchor="middle"
                  className="font-mono pointer-events-none transition-all"
                  style={{
                    fontSize: isSelected || isHovered ? 11 : 10,
                    fontWeight: isSelected || isHovered ? 600 : 400,
                    fill: isSelected
                      ? "var(--color-foreground)"
                      : isHovered
                        ? node.color.text
                        : "var(--color-secondary)",
                  }}
                >
                  {node.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating Canvas Controls */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 rounded-sm border border-border bg-surface/90 p-1 backdrop-blur-sm shadow-sm">
        <button
          type="button"
          onClick={() => handleZoom("in")}
          title="Zoom in"
          className="cursor-pointer rounded-sm p-1.5 text-secondary hover:bg-raised hover:text-foreground active:scale-95 transition-colors"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => handleZoom("out")}
          title="Zoom out"
          className="cursor-pointer rounded-sm p-1.5 text-secondary hover:bg-raised hover:text-foreground active:scale-95 transition-colors"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <div className="mx-0.5 h-3.5 w-px bg-border" />
        <button
          type="button"
          onClick={fitView}
          title="Fit graph to view"
          className="cursor-pointer rounded-sm p-1.5 text-secondary hover:bg-raised hover:text-foreground active:scale-95 transition-colors"
          aria-label="Fit graph to view"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleReset}
          title="Reset and settle layout"
          className="cursor-pointer rounded-sm p-1.5 text-secondary hover:bg-raised hover:text-foreground active:scale-95 transition-colors"
          aria-label="Reset layout"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* Quick Summary Pill on Bottom Left */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-10 hidden sm:flex items-center gap-2 rounded-sm border border-border bg-surface/90 px-3 py-1.5 text-xs text-muted backdrop-blur-sm">
        <span className="font-mono text-foreground font-medium">{nodes.length}</span> files ·{" "}
        <span className="font-mono text-foreground font-medium">{links.length}</span> dependency edges
        {selectedNodeId && (
          <span className="ml-1 text-amber">· 1 file selected</span>
        )}
      </div>

      {/* Hover Tooltip */}
      {tooltip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-sm border border-border bg-raised px-3 py-2 shadow-md backdrop-blur-sm"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.content}
        </div>
      )}

      {/* Inspector Side Drawer when a Node is Selected */}
      {selectedNode && (
        <div className="animate-fade-in absolute top-12 right-0 bottom-0 z-20 w-80 max-w-full border-l border-border bg-surface/95 p-4 backdrop-blur-md overflow-y-auto shadow-lg flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
            <div className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-foreground">
                <FileCode className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                {selectedNode.name}
              </span>
              <span className="font-mono text-[10px] text-muted break-all">
                {selectedNode.id}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedNodeId(null)}
              className="cursor-pointer rounded-sm p-1 text-muted hover:bg-raised hover:text-foreground transition-colors"
              aria-label="Close inspector"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-sm border border-border bg-raised/50 p-2">
              <span className="text-[10px] text-muted uppercase tracking-wider block">Imports</span>
              <span className="font-mono text-base font-bold text-amber">
                {selectedNode.outDegree}
              </span>
            </div>
            <div className="rounded-sm border border-border bg-raised/50 p-2">
              <span className="text-[10px] text-muted uppercase tracking-wider block">Imported By</span>
              <span className="font-mono text-base font-bold text-emerald">
                {selectedNode.inDegree}
              </span>
            </div>
          </div>

          {/* Outbound Dependencies (What this file imports) */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground flex items-center justify-between">
              <span>Imports ({selectedNodeImports.length})</span>
              <span className="text-[10px] text-amber font-mono">Outbound →</span>
            </span>
            {selectedNodeImports.length === 0 ? (
              <p className="text-xs text-muted italic">No internal imports</p>
            ) : (
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                {selectedNodeImports.map((dep, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedNodeId(dep.to)}
                    className="cursor-pointer rounded-sm border border-border bg-raised/40 p-2 text-left hover:border-foreground/30 transition-colors"
                  >
                    <span className="font-mono text-xs text-foreground block truncate">
                      {getBasename(dep.to)}
                    </span>
                    <span className="font-mono text-[10px] text-muted block truncate">
                      {dep.to}
                    </span>
                    <p className="mt-1 font-mono text-[10px] text-secondary/80 line-clamp-2 bg-surface p-1 rounded-sm">
                      {dep.evidence}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Inbound Dependents (What files import this file) */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground flex items-center justify-between">
              <span>Imported By ({selectedNodeDependents.length})</span>
              <span className="text-[10px] text-emerald font-mono">← Inbound</span>
            </span>
            {selectedNodeDependents.length === 0 ? (
              <p className="text-xs text-muted italic">No internal dependents</p>
            ) : (
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                {selectedNodeDependents.map((dep, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedNodeId(dep.from)}
                    className="cursor-pointer rounded-sm border border-border bg-raised/40 p-2 text-left hover:border-foreground/30 transition-colors"
                  >
                    <span className="font-mono text-xs text-foreground block truncate">
                      {getBasename(dep.from)}
                    </span>
                    <span className="font-mono text-[10px] text-muted block truncate">
                      {dep.from}
                    </span>
                    <p className="mt-1 font-mono text-[10px] text-secondary/80 line-clamp-2 bg-surface p-1 rounded-sm">
                      {dep.evidence}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

