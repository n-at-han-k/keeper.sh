import { normalizeBasePath } from "@keeper.sh/constants";

/**
 * The path prefix this build is served under, as "" or "/keeper".
 *
 * Vite sets import.meta.env.BASE_URL from the `base` option in vite.config.ts
 * (itself read from the BASE_PATH build argument), and makes it available to
 * both the client and SSR bundles. Deriving the prefix from it here means there
 * is exactly one place the value enters the web application.
 */
export const BASE_PATH = normalizeBasePath(import.meta.env.BASE_URL);
