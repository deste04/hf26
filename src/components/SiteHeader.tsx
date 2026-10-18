"use client";
import { useEffect, useState, type ReactNode } from "react";

/** The sticky header: see-through over the page's glow at the top, a frosted bar once the page scrolls under it. */
export function SiteHeader({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <header className="site-header" data-scrolled={scrolled || undefined}>
      {children}
    </header>
  );
}
