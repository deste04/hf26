import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** The fixed pages. Profiles are reached from the graph and aren't listed: there's no index of every handle. */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => new URL(path, SITE_URL).toString();
  return [
    { url: url("/"), changeFrequency: "daily", priority: 1 },
    { url: url("/mcp"), changeFrequency: "monthly", priority: 0.5 },
    { url: url("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: url("/terms"), changeFrequency: "yearly", priority: 0.2 },
  ];
}
