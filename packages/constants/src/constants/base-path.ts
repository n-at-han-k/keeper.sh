/**
 * Serving Keeper.sh under a path prefix (e.g. https://host/keeper) rather than
 * at the root of an origin.
 *
 * Upstream assumes the root: the API's Bun.FileSystemRouter matches "/api/...",
 * the auth handler compares pathnames against literal "/api/auth/..." strings,
 * and the web client fetches absolute paths like "/api/calendars". Put a
 * gateway in front that routes /keeper/api -> api:3001 without rewriting, and
 * none of that matches.
 *
 * The prefix cannot simply be rewritten away at the proxy either, because
 * several URLs Keeper.sh mints are absolute and travel off-instance: the
 * better-auth OIDC issuer, the MCP JWKS and resource URLs, and OAuth
 * redirect_uri values. Those must contain the prefix or the provider rejects
 * them, so the application has to know the prefix rather than be shielded
 * from it.
 *
 * BASE_PATH is empty by default, which reproduces upstream behaviour exactly.
 */

/**
 * Normalizes a configured prefix to either "" or "/segment" (leading slash, no
 * trailing slash). "", "/", and undefined all mean "mounted at the root".
 */
export function normalizeBasePath(value: string | undefined | null): string {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "/") {
    return "";
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

/**
 * Removes the prefix from a pathname, so the rest of the application sees the
 * root-relative path it was written against. A request for exactly the prefix
 * ("/keeper") becomes "/". Pathnames that do not carry the prefix are returned
 * unchanged — health probes and in-cluster callers address the pod directly and
 * legitimately omit it.
 */
export function stripBasePath(pathname: string, basePath: string): string {
  if (!basePath) {
    return pathname;
  }

  if (pathname === basePath) {
    return "/";
  }

  if (pathname.startsWith(`${basePath}/`)) {
    return pathname.slice(basePath.length);
  }

  return pathname;
}

/**
 * Prepends the prefix to a root-relative path, for URLs that are handed out
 * rather than consumed.
 */
export function joinBasePath(pathname: string, basePath: string): string {
  if (!basePath) {
    return pathname;
  }

  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${basePath}${withLeadingSlash === "/" ? "" : withLeadingSlash}`;
}

/**
 * Rebuilds a Request with the prefix stripped from its URL, preserving method,
 * headers, body and query string. Bun's FileSystemRouter and the auth handler
 * both read request.url, so rewriting it once at the server edge is what lets
 * every downstream comparison stay written against the root.
 */
export function stripBasePathFromRequest(request: Request, basePath: string): Request {
  if (!basePath) {
    return request;
  }

  const url = new URL(request.url);
  const stripped = stripBasePath(url.pathname, basePath);

  if (stripped === url.pathname) {
    return request;
  }

  url.pathname = stripped;

  return new Request(url.toString(), request);
}
