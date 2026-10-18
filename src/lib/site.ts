/** Names and the public address shared by the metadata, sitemap, robots and manifest. */
export const SITE_NAME = "Vouch Explorer";
export const SITE_TAGLINE = "Trust graph for open-source maintainers";
export const SITE_DESCRIPTION =
  "See who is vouched for or denounced across open-source projects. Vouch Explorer joins every public VOUCHED.td list into one graph, with AI briefs that cite real GitHub evidence and never give a score.";
export const REPO_URL = "https://github.com/deste04/hf26";

/** APP_URL when set, else the production address Vercel provides, else the dev server. */
export const SITE_URL = new URL(
  process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"),
);
