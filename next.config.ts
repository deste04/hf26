import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "use cache" keeps GitHub reads (VOUCHED.td files, users, contributions) across requests without a database.
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
