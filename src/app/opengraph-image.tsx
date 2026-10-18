import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME}: ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The share card: the mark, the name and the tagline, in the site's green on white. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "0 96px", background: "#ffffff", color: "#141414",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <svg width="120" height="120" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="8" fill="#0db879" />
            <path d="M8 16.5l5.5 5.5L24 10" fill="none" stroke="#102016" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="8" cy="16.5" r="3.1" fill="#102016" />
            <circle cx="13.5" cy="22" r="3.1" fill="#102016" />
            <circle cx="24" cy="10" r="3.1" fill="#102016" />
          </svg>
          <div style={{ display: "flex", fontSize: 80, fontWeight: 700, letterSpacing: -2 }}>
            Vouch<span style={{ marginLeft: 20, fontWeight: 400, color: "#5c5c5c" }}>Explorer</span>
          </div>
        </div>
        <div style={{ marginTop: 48, fontSize: 44, lineHeight: 1.25, maxWidth: 940 }}>
          See who is vouched for or denounced across open-source projects, in one trust graph.
        </div>
        <div style={{ marginTop: 32, fontSize: 30, color: "#087c54" }}>Public VOUCHED.td lists. AI explains, humans decide</div>
      </div>
    ),
    size,
  );
}
