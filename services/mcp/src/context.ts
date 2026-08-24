import { isKeeperMcpEnabledAuth, createAuth } from "@keeper.sh/auth";
import { createDatabase } from "@keeper.sh/database";
import { normalizeBasePath } from "@keeper.sh/constants";
import env from "./env";
import { createKeeperMcpHandler } from "./mcp-handler";
import { createKeeperMcpToolset } from "./toolset";
import { withWideEvent } from "./utils/middleware";

// Path prefix this instance is served under; "" reproduces upstream behaviour.
const basePath = normalizeBasePath(env.BASE_PATH);

const database = await createDatabase(env.DATABASE_URL, { maxConnections: env.DATABASE_POOL_MAX });

const { auth: baseAuth } = createAuth({
  database,
  secret: env.BETTER_AUTH_SECRET,
  baseUrl: env.BETTER_AUTH_URL,
  basePath,
  commercialMode: env.COMMERCIAL_MODE ?? false,
  mcpResourceUrl: env.MCP_PUBLIC_URL,
  mcpApiBaseUrl: env.MCP_API_URL,
});

if (!isKeeperMcpEnabledAuth(baseAuth)) {
  throw new Error("MCP auth is not configured — ensure mcpResourceUrl is set");
}

const auth = baseAuth;
const keeperMcpToolset = createKeeperMcpToolset();
const handleMcpRequest = createKeeperMcpHandler({
  auth,
  mcpPublicUrl: env.MCP_PUBLIC_URL,
  apiBaseUrl: env.MCP_API_URL ?? env.BETTER_AUTH_URL,
  toolset: keeperMcpToolset,
});

export { auth, basePath, database, env, handleMcpRequest, keeperMcpToolset, withWideEvent };
