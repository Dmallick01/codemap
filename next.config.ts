import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ["web-tree-sitter", "unzipper"],
};

export default nextConfig;
