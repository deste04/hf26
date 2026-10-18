"use client";

// Every new page opens at the top. Next keeps the scroll position when the new page is still partly in view, so
// leaving the end of a long page for a short one (privacy → terms, anything → home) landed at its end.
// Back and forward are left to the browser, which restores where you were; so are links to a #section.
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

export function ScrollReset() {
  const pathname = usePathname();
  const first = useRef(true);
  const popped = useRef(false);

  useEffect(() => {
    const onPop = () => {
      popped.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Before paint, so the old position never shows.
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!popped.current && !window.location.hash) window.scrollTo({ top: 0, behavior: "instant" });
    popped.current = false;
  }, [pathname]);

  return null;
}
