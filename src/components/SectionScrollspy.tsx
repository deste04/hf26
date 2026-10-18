"use client";

// Floating section bar for the text pages (privacy, terms, MCP): the current section's title above a tick track that
// shows how far down the page you are. Click or drag the track to scroll there.
// Adapted from Space UI's Section Scrollspy (spaceui.one), restyled with Arc tokens instead of Tailwind.
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState, type PointerEvent } from "react";

const TICKS = 31;
/** A section becomes the current one once its top passes this share of the viewport height. */
const LINE = 0.35;
/** Thumb width, in px: it travels the track minus its own width. */
const THUMB = 6;

export function SectionScrollspy({ selector = "[data-page-section]" }: { selector?: string }) {
  const [titles, setTitles] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const [width, setWidth] = useState(0);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const ticks = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const thumbX = useTransform(scrollYProgress, (p) => p * Math.max(0, width - THUMB));

  // Sections of this page only: Next keeps pages already visited in the DOM, hidden, so the whole document would
  // also hold theirs. The pages are static, so their sections are read once, each time the page is shown again.
  useEffect(() => {
    const page = anchor.current?.parentElement;
    if (!page) return;
    const sections = Array.from(page.querySelectorAll<HTMLElement>(selector)).filter((s) => s.querySelector("h2"));
    setTitles(sections.map((s) => s.querySelector("h2")?.textContent?.trim() ?? ""));
    const update = () => {
      const line = window.innerHeight * LINE;
      let current = -1;
      sections.forEach((s, i) => {
        if (s.getBoundingClientRect().top <= line) current = i;
      });
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [selector]);

  useEffect(() => {
    const el = ticks.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, [titles.length]);

  const progressAt = (clientX: number) => {
    const rect = ticks.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
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
    if (e.pointerType === "mouse") setHoverX(progressAt(e.clientX) * Math.max(0, width - THUMB));
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
              <motion.span
                key={i}
                className="scrollspy-tick"
                initial={{ opacity: 0.2 }}
                animate={{ opacity: i % 5 === 0 ? 1 : 0.2 }}
                transition={{ duration: 0.2, delay: i % 5 === 0 ? (i / 5) * 0.05 : 0, ease: "easeOut" }}
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
