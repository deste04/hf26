"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Explore", match: (p: string) => p === "/" },
];

export default function NavLinks() {
  return <Links path={usePathname() ?? "/"} />;
}

/** Same links without a current page: the fallback while a dynamic route's pathname is still unknown. */
export function NavLinksFallback() {
  return <Links path="" />;
}

function Links({ path }: { path: string }) {
  return (
    <nav className="nav" aria-label="Main">
      {LINKS.map((l) => (
        <Link key={l.label} href={l.href} aria-current={l.match(path) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
