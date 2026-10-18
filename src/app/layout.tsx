import type { Metadata } from "next";
import { Geist_Mono, Outfit } from "next/font/google";
import Link from "next/link";
import Header from "@/components/Header";
import Providers from "@/components/Providers";
import "@/components/arc/foundation.css";
import "./globals.css";

const sans = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Vouch Explorer",
  description: "Connects Vouch trust lists across open-source projects. AI explains, humans decide.",
};

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
      </head>
      <body>
        <Providers>
          <Header />
          <main>{children}</main>
          <footer className="site-footer">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href="https://github.com/deste04/hf26">Source</a>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
