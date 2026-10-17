"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/arc/button/button";
import type { TrustEdge } from "@/server/trust/types";

type Props = { center: { kind: "user" | "project"; id: string }; edges: TrustEdge[] };

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

const FONT_MONO = "Geist Mono, ui-monospace, monospace";
const FONT_BODY = "Inter, system-ui, sans-serif";

/** Size tier from node count: small graphs stay compact, big ones get rings and more room. */
function tier(n: number) {
  if (n <= 8) return { height: 340, maxZoom: 1.3, font: 12, pad: 8, ring: Infinity, spacing: 60, edge: 2 };
  if (n <= 40) return { height: 460, maxZoom: 1.2, font: 11, pad: 6, ring: Infinity, spacing: 24, edge: 1.5 };
  return { height: 640, maxZoom: 1.1, font: 10, pad: 4, ring: 48, spacing: 8, edge: 1 };
}

export default function TrustGraph({ center, edges }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<import("cytoscape").Core | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const router = useRouter();
  const nodeCount = 1 + new Set(edges.map((e) => (center.kind === "user" ? e.project : e.login))).size;
  const t = tier(nodeCount);
  const denouncedCount = edges.filter((e) => e.status === "denounced").length;

  const styleFor = (c: Palette): import("cytoscape").StylesheetJson => [
    {
      selector: "node",
      style: {
        label: "data(label)",
        shape: "round-rectangle",
        width: "label" as never,
        height: "label" as never,
        padding: `${t.pad}px` as never,
        "font-family": FONT_MONO,
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
    {
      selector: "node[isCenter = 1]",
      style: {
        shape: "round-rectangle",
        "corner-radius": 999 as never,
        padding: "12px" as never,
        "background-color": c.fg,
        "border-width": 0,
        color: c.bg,
        "font-family": FONT_BODY,
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
        "font-family": FONT_BODY,
        color: c.secondary,
        "text-background-color": c.surface,
        "text-background-opacity": 1,
        "text-background-padding": "3px",
      },
    },
    { selector: 'edge[status = "denounced"]', style: { opacity: 1, width: Math.max(2, t.edge), "z-index": 10 } },
  ];

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
            label: edges.length > 30 ? "" : e.voucher ? `by @${e.voucher}` : "unknown",
            // Denounced stays red even with an unknown voucher (dashed); unknown vouches are dashed grey.
            hasVoucher: e.voucher ? 1 : 0,
            style: e.voucher ? "solid" : "dashed",
            status: e.status,
          },
        });
      });
      // Large graphs: spread leaves over several concentric rings instead of one giant circle.
      // Denounced nodes go on their own inner ring so they are never lost in a big graph.
      let leaf = 0;
      const vouchedCount = [...nodes.values()].filter((n) => n.status === "vouched").length;
      const rings = Math.max(1, Math.ceil(vouchedCount / t.ring));
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
  }, [center.kind, center.id, edges, router]);

  return (
    <div ref={wrapRef} className={`graph-wrap${fullscreen ? " is-fullscreen" : ""}`}>
      <div className="graph-tools">
        {/* The card header carries the count; fullscreen hides it, so the toolbar repeats it there. */}
        <span className="muted small">
          {fullscreen && `${nodeCount - 1} ${center.kind === "user" ? (nodeCount === 2 ? "project" : "projects") : nodeCount === 2 ? "user" : "users"}`}
        </span>
        <Button variant="ghost" size="sm" onClick={fit}>
          Fit
        </Button>
        <Button variant="ghost" size="sm" onClick={toggleFullscreen} aria-pressed={fullscreen}>
          {fullscreen ? "Exit fullscreen" : "Fullscreen"}
        </Button>
      </div>
      <div
        ref={ref}
        className="graph"
        style={{ height: fullscreen ? undefined : t.height }}
        role="img"
        aria-label={`Trust graph for ${center.id}: ${edges.length} vouch list entries. The table below lists the same data.`}
      />
      <div className="legend" aria-hidden="true">
        <span><i style={{ borderColor: "var(--success)" }} />Vouched</span>
        <span><i style={{ borderColor: "var(--text-muted)", borderTopStyle: "dashed" }} />Unknown voucher</span>
        <span><i style={{ borderColor: "var(--danger)" }} />Denounced{denouncedCount ? ` (${denouncedCount}, inner ring)` : ""}</span>
        <span>Click a node to explore it</span>
      </div>
    </div>
  );
}
