"use client";

// Floating section bar for the text pages (privacy, terms, MCP): the current section's title above a tick track that
// shows how far down the page you are. Each tall tick is where a section starts: the thumb reaches it exactly when that
// section becomes the current one. Click or drag the track to scroll there; near a tall tick it snaps to the section.
// Adapted from Space UI's Section Scrollspy (spaceui.one), restyled with Arc tokens instead of Tailwind.
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState, type PointerEvent } from "react";

/** Faint evenly spaced ticks behind the section marks. */
const TICKS = 31;
/** A section becomes the current one once its top passes this share of the viewport height. */
const LINE = 0.35;
/** Thumb width, in px: it travels the track minus its own width. */
const THUMB = 6;
/** Clicks and drags this close to a section mark, in px, land exactly on it. */
const SNAP = 6;

/**
 * Scroll progress (0–1) at which each section becomes the current one: when its top crosses LINE. Sections too close
 * to the end of the page never get there, so they share the rest of the track, in order, ending at the very bottom.
 */
function sectionMarks(sections: HTMLElement[]): number[] {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (max <= 0) return sections.map(() => 0);
  const line = window.innerHeight * LINE;
  const raw = sections.map((s) => Math.max(0, (s.getBoundingClientRect().top + window.scrollY - line) / max));
  const late = raw.findIndex((r) => r >= 1);
  if (late === -1) return raw;
  const from = late > 0 ? raw[late - 1] : 0;
  const rest = raw.length - late;
  return raw.map((r, i) => (i < late ? r : from + ((1 - from) * (i - late + 1)) / rest));
}

export function SectionScrollspy({ selector = "[data-page-section]" }: { selector?: string }) {
  const [titles, setTitles] = useState<string[]>([]);
  const [marks, setMarks] = useState<number[]>([]);
  const [active, setActive] = useState(-1);
  const [width, setWidth] = useState(0);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const ticks = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const travel = Math.max(0, width - THUMB);
  const thumbX = useTransform(scrollYProgress, (p) => p * travel);

  // Sections of this page only: Next keeps pages already visited in the DOM, hidden, so the whole document would
  // also hold theirs. The pages are static, so their sections are read once, each time the page is shown again.
  useEffect(() => {
    const page = anchor.current?.parentElement;
    if (!page) return;
    const sections = Array.from(page.querySelectorAll<HTMLElement>(selector)).filter((s) => s.querySelector("h2"));
    setTitles(sections.map((s) => s.querySelector("h2")?.textContent?.trim() ?? ""));
    let at: number[] = [];
    // The current section is the last mark the scroll has passed, so title and thumb always agree.
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? window.scrollY / max : 0;
      setActive(at.findLastIndex((m) => m <= progress + 0.001));
    };
    const measure = () => {
      at = sectionMarks(sections);
      setMarks(at);
      update();
    };
    measure();
    // Marks move when the page reflows: a resize, fonts loading, a code block expanding.
    const observer = new ResizeObserver(measure);
    observer.observe(page);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", measure);
    };
  }, [selector]);

  useEffect(() => {
    const el = ticks.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, [titles.length]);

  /** Progress under the pointer, measured like the thumb's centre, snapped to a section mark when close. */
  const progressAt = (clientX: number) => {
    const rect = ticks.current!.getBoundingClientRect();
    const x = clientX - rect.left - THUMB / 2;
    const near = marks.find((m) => Math.abs(m * travel - x) <= SNAP);
    if (near !== undefined) return near;
    return travel > 0 ? Math.max(0, Math.min(1, x / travel)) : 0;
  };
  const scrollTo = (progress: number) =>
    window.scrollTo({ top: (document.documentElement.scrollHeight - window.innerHeight) * progress, behavior: "instant" });

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setHoverX(null);
    scrollTo(progressAt(e.clientX));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) return scrollTo(progressAt(e.clientX));
    if (e.pointerType === "mouse") setHoverX(progressAt(e.clientX) * travel);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };

  // Marks where the bar sits, so the effect above finds this page's sections.
  const marker = <span ref={anchor} hidden />;
  if (titles.length === 0) return marker;
  const title = titles[active];

  // Mouse only, and the same as the page's own scrollbar: hidden from assistive tech.
  return (
    <>
      {marker}
      <div className="scrollspy" aria-hidden="true">
        <AnimatePresence mode="popLayout" initial={false}>
          {title && (
            <motion.div
              key={active}
              className="scrollspy-title"
              initial={reduce ? { opacity: 0 } : { y: "100%", opacity: 0 }}
              animate={{ y: "0%", opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { y: "100%", opacity: 0 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0 }}
            >
              {title}
            </motion.div>
          )}
        </AnimatePresence>
        <div
          className="scrollspy-track"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => setHoverX(null)}
        >
          <div className="scrollspy-ticks" ref={ticks}>
            {Array.from({ length: TICKS }, (_, i) => (
              <span key={i} className="scrollspy-tick" />
            ))}
            {width > 0 &&
              marks.map((m, i) => (
                <motion.span
                  key={i}
                  className="scrollspy-mark"
                  style={{ left: m * travel + THUMB / 2 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: i * 0.05, ease: "easeOut" }}
                />
              ))}
            {hoverX !== null && <span className="scrollspy-thumb is-hover" style={{ transform: `translateX(${hoverX}px)` }} />}
            <motion.span className="scrollspy-thumb" style={{ x: thumbX }} />
          </div>
        </div>
      </div>
    </>
  );
}
