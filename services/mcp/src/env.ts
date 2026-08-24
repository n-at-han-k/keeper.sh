import arkenv from "arkenv";

const schema = {
  BASE_PATH: "string?",
  BETTER_AUTH_SECRET: "string",
  BETTER_AUTH_URL: "string.url",
  COMMERCIAL_MODE: "boolean?",
  DATABASE_POOL_MAX: "number?",
  DATABASE_URL: "string.url",
  MCP_API_URL: "string.url?",
  MCP_PORT: "number",
  MCP_PUBLIC_URL: "string.url",
  // Optional Keeper API token used to serve requests that arrive with no
  // bearer, for running as a cluster-internal MCP backend. See
  // utils/service-token.ts — it must not be set on a publicly routed instance.
  MCP_SERVICE_TOKEN: "string?",
} as const;

const loadMcpEnv = () => arkenv(schema);

type McpEnv = ReturnType<typeof loadMcpEnv>;

const tryLoadMcpEnv = (): McpEnv | null => {
  try {
    return loadMcpEnv();
  } catch {
    return null;
  }
};

export { schema, tryLoadMcpEnv };
export type { McpEnv };
export default loadMcpEnv();
