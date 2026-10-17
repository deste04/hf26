"use client";
import { LocateFixed, Maximize, Minimize, Minus, MousePointerClick, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { TrustEdge } from "@/server/trust/types";

/** `activity`: person view only, repos the person contributed to without being in their VOUCHED.td. */
/** `vouchersPending`: vouchers are still being read, so a missing one means "not yet", not "unknown". */
type Props = { center: { kind: "user" | "project"; id: string }; edges: TrustEdge[]; activity?: string[]; vouchersPending?: boolean };

// Cytoscape draws on canvas and cannot read CSS variables (or oklch), so Arc tokens are resolved to rgb.
const TOKENS = {
  ok: "--success",
  bad: "--danger",
  unknown: "--text-muted",
  fg: "--foreground",
  bg: "--background",
  surface: "--surface",
  muted: "--surface-muted",
  secondary: "--text-secondary",
  border: "--border-strong",
} as const;
type Palette = Record<keyof typeof TOKENS, string>;

function readPalette(): Palette {
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  const css = getComputedStyle(document.documentElement);
  const toRgb = (value: string) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `rgb(${r},${g},${b})`;
  };
  return Object.fromEntries(Object.entries(TOKENS).map(([k, v]) => [k, toRgb(css.getPropertyValue(v).trim())])) as Palette;
}

/** The canvas can't use CSS variables, so read the page's resolved font stacks (Outfit, Geist Mono) once drawn. */
const fonts = () => {
  const css = getComputedStyle(document.documentElement);
  return {
    mono: css.getPropertyValue("--font-mono").trim() || "ui-monospace, monospace",
    body: css.getPropertyValue("--font-body").trim() || "system-ui, sans-serif",
  };
};

/** Size tier from node count: small graphs stay compact, big ones get rings and more room. */
function tier(n: number) {
  if (n <= 8) return { height: 340, maxZoom: 1.3, font: 12, pad: 8, ring: Infinity, spacing: 60, edge: 2 };
  // Mid-size graphs use rings of ~14 too: one big circle of 30+ nodes makes "fit" zoom out until labels are unreadable.
  if (n <= 40) return { height: 520, maxZoom: 1.2, font: 11, pad: 6, ring: 14, spacing: 40, edge: 1.5 };
  return { height: 640, maxZoom: 1.1, font: 10, pad: 4, ring: 48, spacing: 8, edge: 1 };
}

export default function TrustGraph({ center, edges, activity = [], vouchersPending = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<import("cytoscape").Core | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const router = useRouter();
  const nodeCount = 1 + new Set(edges.map((e) => (center.kind === "user" ? e.project : e.login))).size + activity.length;
  const t = tier(nodeCount);
  const denouncedCount = edges.filter((e) => e.status === "denounced").length;

  const styleFor = (c: Palette, f = fonts()): import("cytoscape").StylesheetJson => [
    {
      selector: "node",
      style: {
        label: "data(label)",
        shape: "round-rectangle",
        width: "label" as never,
        height: "label" as never,
        padding: `${t.pad}px` as never,
        "font-family": f.mono,
        "font-size": t.font,
        color: c.fg,
        "text-valign": "center",
        "text-halign": "center",
        "background-color": c.muted,
        "border-width": 1,
        "border-color": c.ok,
      },
    },
    { selector: 'node[kind = "user"]', style: { "background-color": c.surface, "border-color": c.border } },
    {
      selector: 'node[status = "denounced"]',
      style: { "background-color": c.surface, color: c.bad, "border-color": c.bad, "border-width": 2, "font-weight": 600, "z-index": 10 },
    },
    // More than a handful of nodes: dots with the name underneath. Label-sized boxes widen every ring until "fit"
    // shrinks the text out of reach; dots keep the rings tight, so every node stays on screen and readable.
    ...(nodeCount > 8
      ? ([
          {
            selector: "node[isCenter = 0]",
            style: {
              shape: "ellipse",
              width: 12,
              height: 12,
              padding: "0px" as never,
              "background-color": c.ok,
              "border-width": 0,
              "text-valign": "bottom",
              "text-margin-y": 4,
              "font-size": t.font + 1,
              color: c.secondary,
            },
          },
          { selector: 'node[isCenter = 0][status = "denounced"]', style: { "background-color": c.bad, color: c.bad } },
          { selector: 'node[isCenter = 0][status = "activity"]', style: { "background-color": c.unknown } },
        ] as import("cytoscape").StylesheetJson)
      : []),
    {
      selector: "node[isCenter = 1]",
      style: {
        shape: "round-rectangle",
        "corner-radius": 999 as never,
        padding: "12px" as never,
        "background-color": c.fg,
        "border-width": 0,
        color: c.bg,
        "font-family": f.body,
        "font-weight": 600,
        "font-size": 14,
      },
    },
    {
      selector: "edge",
      style: {
        width: t.edge,
        opacity: nodeCount > 40 ? 0.55 : 1,
        "line-color": (e: import("cytoscape").EdgeSingular) =>
          e.data("status") === "denounced" ? c.bad : e.data("hasVoucher") ? c.ok : c.unknown,
        "line-style": "data(style)" as never,
        "curve-style": "straight",
        label: "data(label)",
        "font-size": 11,
        "font-family": f.body,
        color: c.secondary,
        "text-background-color": c.surface,
        "text-background-opacity": 1,
        "text-background-padding": "3px",
      },
    },
    { selector: 'edge[status = "denounced"]', style: { opacity: 1, width: Math.max(2, t.edge), "z-index": 10 } },
    // Contribution without a vouch list entry: present, but quieter than any trust edge.
    { selector: 'edge[status = "activity"]', style: { width: 1, opacity: 0.45, "line-color": c.unknown, "line-style": "dotted" as never } },
    { selector: 'node[status = "activity"]', style: { "border-color": c.border, "border-style": "dotted" as never } },
  ];

  /** Zoom by a step around the middle of the view, within the graph's zoom limits. */
  const zoomBy = (factor: number) => {
    const cy = cyRef.current;
    if (!cy) return;
    const level = Math.min(cy.maxZoom(), Math.max(cy.minZoom(), cy.zoom() * factor));
    cy.animate({ zoom: { level, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } } }, { duration: 160 });
  };

  const fit = () => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.resize();
    cy.fit(undefined, 24);
    if (cy.zoom() > t.maxZoom) {
      cy.zoom(t.maxZoom);
      cy.center();
    }
  };

  // Resize and re-fit when entering/leaving fullscreen (Esc exits natively).
  useEffect(() => {
    const onChange = () => {
      setFullscreen(document.fullscreenElement === wrapRef.current);
      requestAnimationFrame(fit);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  });

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else wrapRef.current?.requestFullscreen?.();
  };

  useEffect(() => {
    let cy: import("cytoscape").Core | undefined;
    let themeObserver: MutationObserver | undefined;
    let cancelled = false;
    (async () => {
      const cytoscape = (await import("cytoscape")).default;
      if (cancelled || !ref.current) return;
      const centerId = `${center.kind}:${center.id}`;
      const nodes = new Map<string, { id: string; label: string; kind: string; status: string }>();
      nodes.set(centerId, { id: centerId, label: center.kind === "user" ? `@${center.id}` : center.id, kind: center.kind, status: "center" });
      const els: import("cytoscape").ElementDefinition[] = [];
      edges.forEach((e, i) => {
        const other = center.kind === "user" ? { id: `project:${e.project}`, label: e.project, kind: "project" } : { id: `user:${e.login}`, label: e.login, kind: "user" };
        if (!nodes.has(other.id)) nodes.set(other.id, { ...other, status: e.status });
        const [source, target] = center.kind === "user" ? [other.id, centerId] : [centerId, other.id];
        els.push({
          data: {
            id: `e${i}`,
            source,
            target,
            label: edges.length > 30 ? "" : e.voucher ? `by @${e.voucher}` : vouchersPending ? "" : "unknown",
            // Denounced stays red even with an unknown voucher (dashed); unknown vouches are dashed grey.
            hasVoucher: e.voucher ? 1 : 0,
            style: e.voucher || vouchersPending ? "solid" : "dashed",
            status: e.status,
          },
        });
      });
      for (const repo of activity) {
        const id = `project:${repo}`;
        if (nodes.has(id)) continue;
        nodes.set(id, { id, label: repo, kind: "project", status: "activity" });
        els.push({ data: { id: `a:${repo}`, source: id, target: centerId, label: "", hasVoucher: 0, style: "dotted", status: "activity" } });
      }
      // Large graphs: spread leaves over several concentric rings instead of one giant circle.
      // Denounced nodes go on their own inner ring so they are never lost in a big graph.
      let leaf = 0;
      const leafCount = [...nodes.values()].filter((n) => n.status === "vouched" || n.status === "activity").length;
      const rings = Math.max(1, Math.ceil(leafCount / t.ring));
      const hasDenounced = [...nodes.values()].some((n) => n.status === "denounced");
      for (const n of nodes.values()) {
        const isCenter = n.id === centerId;
        const level = isCenter ? rings + 2 : n.status === "denounced" ? rings + 1 : rings - (leaf++ % rings);
        els.unshift({ data: { ...n, isCenter: isCenter ? 1 : 0, level: hasDenounced || isCenter ? level : Math.min(level, rings) } });
      }

      cy = cytoscape({
        container: ref.current,
        elements: els,
        wheelSensitivity: 0.3,
        layout:
          nodes.size > 2
            ? { name: "concentric", concentric: (n) => n.data("level"), levelWidth: () => 1, minNodeSpacing: t.spacing, padding: 24, animate: false }
            : { name: "grid", animate: false },
        minZoom: 0.1,
        maxZoom: 3,
        style: styleFor(readPalette()),
      });
      cyRef.current = cy;
      fit();
      // Re-color when the Arc theme switch flips data-theme on <html>.
      themeObserver = new MutationObserver(() => cy?.style(styleFor(readPalette())));
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-accent"] });
      // Every node but the centre opens its own map: show it with the pointer.
      cy.on("mouseover", "node[isCenter = 0]", () => {
        if (ref.current) ref.current.style.cursor = "pointer";
      });
      cy.on("mouseout", "node", () => {
        if (ref.current) ref.current.style.cursor = "";
      });
      cy.on("tap", "node", (evt) => {
        const d = evt.target.data();
        if (d.isCenter) return;
        router.push(`/?q=${encodeURIComponent(d.kind === "project" ? d.label : d.label.replace(/^@/, ""))}`);
      });
    })();
    return () => {
      cancelled = true;
      themeObserver?.disconnect();
      cy?.destroy();
      cyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.kind, center.id, edges, activity, vouchersPending, router]);

  return (
    <div ref={wrapRef} className={`graph-wrap${fullscreen ? " is-fullscreen" : ""}`}>
      <div className="graph-tools">
        {/* The card header carries the count; fullscreen hides it, so the toolbar repeats it there. */}
        <span className="muted small">
          {fullscreen && `${nodeCount - 1} ${center.kind === "user" ? (nodeCount === 2 ? "project" : "projects") : nodeCount === 2 ? "user" : "users"}`}
        </span>
        {/* Map-style controls: one compact group of icon buttons, each named for screen readers and on hover. */}
        <div className="graph-controls" role="toolbar" aria-label="Graph view">
          <button type="button" onClick={() => zoomBy(1.25)} aria-label="Zoom in" title="Zoom in">
            <Plus size={16} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => zoomBy(0.8)} aria-label="Zoom out" title="Zoom out">
            <Minus size={16} aria-hidden="true" />
          </button>
          <button type="button" onClick={fit} aria-label="Fit the whole graph" title="Fit the whole graph">
            <LocateFixed size={16} aria-hidden="true" />
          </button>
          <span className="graph-controls-sep" aria-hidden="true" />
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-pressed={fullscreen}
            aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <Minimize size={16} aria-hidden="true" /> : <Maximize size={16} aria-hidden="true" />}
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="graph"
        style={{ height: fullscreen ? undefined : t.height }}
        role="img"
        aria-label={`Trust graph for ${center.id}: ${edges.length} vouch list entries${activity.length ? ` and ${activity.length} repos with activity only` : ""}. The table below lists the vouch entries.`}
      />
      <div className="legend" aria-hidden="true">
        <span><i style={{ borderColor: "var(--success)" }} />Vouched</span>
        <span><i style={{ borderColor: "var(--text-muted)", borderTopStyle: "dashed" }} />Unknown voucher</span>
        <span><i style={{ borderColor: "var(--danger)" }} />Denounced{denouncedCount ? ` (${denouncedCount}, inner ring)` : ""}</span>
        {activity.length > 0 && <span><i style={{ borderColor: "var(--text-muted)", borderTopStyle: "dotted", opacity: 0.7 }} />Activity only</span>}
        <span className="legend-hint">
          <MousePointerClick size={14} aria-hidden="true" />
          Click a {center.kind === "user" ? "project" : "person"} to open its trust map
        </span>
      </div>
    </div>
  );
}
