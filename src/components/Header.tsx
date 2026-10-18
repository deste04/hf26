import Link from "next/link";
import AccountMenu from "./AccountMenu";
import AiQueue from "./AiQueue";
import { Suspense } from "react";
import NavLinks, { NavLinksFallback } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";

export default function Header() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="6" cy="6" r="3" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="12" cy="18" r="3" />
            <path d="M8 8l3 7M16 8l-3 7M9 6h6" />
          </svg>
          <span>Vouch Explorer</span>
        </Link>
        <Suspense fallback={<NavLinksFallback />}>
          <NavLinks />
        </Suspense>
        <div className="header-tools">
          <AiQueue />
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
