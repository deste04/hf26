import Link from "next/link";
import AccountMenu from "./AccountMenu";
import { SiteHeader } from "./SiteHeader";
import { ThemeToggle } from "./ThemeToggle";

export default function Header() {
  return (
    <SiteHeader>
      <div className="site-header-inner">
        <Link href="/" className="brand" aria-label="Vouch Explorer, home">
          <svg className="brand-mark" width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="8" />
            <path d="M8 16.5l5.5 5.5L24 10" />
            <circle cx="8" cy="16.5" r="3.1" />
            <circle cx="13.5" cy="22" r="3.1" />
            <circle cx="24" cy="10" r="3.1" />
          </svg>
          <span className="brand-name">
            Vouch<span>Explorer</span>
          </span>
        </Link>
        <div className="header-tools">
          <Link href="/mcp" className="link-btn header-link">
            MCP
          </Link>
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>
    </SiteHeader>
  );
}
