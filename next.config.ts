import type { NextConfig } from "next";

const isPagesBuild = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isPagesBuild ? "/Agentic_Skill_Design-" : "",
  trailingSlash: true,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
