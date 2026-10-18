import type { Metadata, Viewport } from "next";
import { Geist_Mono, Outfit } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import Header from "@/components/Header";
import { ScrollReset } from "@/components/ScrollReset";
import Providers from "@/components/Providers";
import { REPO_URL, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import "@/components/arc/foundation.css";
import "./globals.css";

const sans = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: { default: `${SITE_NAME}: ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["Vouch", "VOUCHED.td", "open source", "maintainers", "trust graph", "GitHub", "contributors", "AI pull requests"],
  authors: [{ name: "deste04", url: "https://github.com/deste04" }],
  openGraph: { type: "website", siteName: SITE_NAME, title: SITE_NAME, description: SITE_DESCRIPTION, locale: "en_US" },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION },
  robots: { index: true, follow: true },
  verification: { google: "M8TDHICHbgJcTaxm45J-aYgUbp0w2KHFm5oLDauxr3c" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1c1c" },
  ],
};

// Tells search engines what the site is, beside the title and description.
const jsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL.toString(),
  description: SITE_DESCRIPTION,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  codeRepository: REPO_URL,
});

// Runs before paint so the saved (or system) theme never flashes the wrong one.
const themeScript = `try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="light"
      data-accent="green"
      className={`${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      </head>
      <body>
        <div className="page-world" aria-hidden="true" />
        <Providers>
          {/* usePathname suspends on /u/[handle], whose handle is only known per request. */}
          <Suspense fallback={null}>
            <ScrollReset />
          </Suspense>
          <Header />
          <main>{children}</main>
          <footer className="site-footer">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href={REPO_URL}>Source</a>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
