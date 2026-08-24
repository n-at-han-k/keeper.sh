import { resolve } from "node:path";
import { defineConfig } from "vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { blogPlugin, comparePlugin, docsPlugin, guidesPlugin, movedPathsPlugin, recipesPlugin } from "./plugins/blog";
import { changelogPlugin } from "./plugins/changelog";
import { feedPlugin } from "./plugins/feed";
import { changelogFeedPlugin } from "./plugins/changelog-feed";
import { sitemapPlugin } from "./plugins/sitemap";

/**
 * Path prefix this build is served under, e.g. "/keeper". Vite bakes asset URLs
 * at build time, so unlike the API and MCP services — where BASE_PATH is read at
 * runtime — the web image is prefix-specific and must be built with it set. Vite
 * exposes the value to both the client and SSR bundles as import.meta.env.BASE_URL,
 * which is what the router and the API fetcher derive their prefix from.
 */
const basePath = (() => {
  const configured = process.env.BASE_PATH?.trim();
  if (!configured || configured === "/") {
    return "/";
  }
  const withLeadingSlash = configured.startsWith("/") ? configured : `/${configured}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
})();

export default defineConfig(({ isSsrBuild }) => ({
  base: basePath,
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
  plugins: [
    blogPlugin(),
    changelogPlugin(),
    comparePlugin(),
    docsPlugin(),
    guidesPlugin(),
    recipesPlugin(),
    tailwindcss(),
    tanstackRouter({
      autoCodeSplitting: true,
      generatedRouteTree: "src/generated/tanstack/route-tree.generated.ts",
      target: "react",
    }),
    react(),
    babel({
      presets: [
        ["@babel/preset-typescript", { isTSX: true, allExtensions: true }],
        reactCompilerPreset(),
      ],
    }),
    svgr(),
    !isSsrBuild && movedPathsPlugin(),
    !isSsrBuild && sitemapPlugin(),
    !isSsrBuild && feedPlugin(),
    !isSsrBuild && changelogFeedPlugin(),
  ].filter(Boolean),
  build: {
    manifest: !isSsrBuild,
    sourcemap: process.env.ENV !== "production",
    rollupOptions: !isSsrBuild
      ? {
          external: ["mermaid"],
          output: {
            manualChunks(id) {
              if (id.includes("/react-dom/") || id.includes("/react/")) {
                return "react-vendor";
              }
            },
          },
        }
      : undefined,
  },
  server: {
    allowedHosts: ["macbook"],
    host: "0.0.0.0",
    proxy: {
      "/api": {
        changeOrigin: true,
        target: "http://localhost:3000",
        ws: true,
      },
      "/mcp": {
        changeOrigin: true,
        target: "http://localhost:3001",
      },
    },
  },
}));
