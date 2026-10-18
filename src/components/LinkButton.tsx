import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** GitHub's mark (Octicons mark-github, MIT). Lucide dropped brand icons in 1.0. */
export function GithubMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/**
 * A link styled as a secondary button, with a trailing arrow that slides out and back in on hover or focus:
 * up-right for links that leave the site, right for links within it.
 */
export function LinkButton({ href, external = false, icon, className, children }: { href: string; external?: boolean; icon?: ReactNode; className?: string; children: ReactNode }) {
  const Arrow = external ? ArrowUpRight : ArrowRight;
  const cls = className ? `link-btn ${className}` : "link-btn";
  const body = (
    <>
      {icon}
      <span>{children}</span>
      <span className={`link-btn-arrow${external ? " is-external" : ""}`} aria-hidden="true">
        <Arrow size={16} />
        <Arrow size={16} />
      </span>
    </>
  );
  return external ? (
    <a className={cls} href={href} target="_blank" rel="noreferrer">
      {body}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  ) : (
    <Link className={cls} href={href}>
      {body}
    </Link>
  );
}
