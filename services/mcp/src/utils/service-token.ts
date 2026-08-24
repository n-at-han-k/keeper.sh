import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { apiTokensTable } from "@keeper.sh/database/schema";
import { KEEPER_API_RESOURCE_SCOPES } from "@keeper.sh/auth";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";

/**
 * Authenticating the MCP server when it runs as a managed backend rather than
 * as a public endpoint.
 *
 * Upstream Keeper.sh expects every MCP request to carry an OAuth bearer token
 * minted by its own authorization server and obtained interactively by the
 * client. That assumes the MCP server is reachable by that client and that a
 * human is present to consent.
 *
 * Under an MCP aggregator the server is a cluster-internal backend: the
 * aggregator dials it pod-to-pod with no Authorization header at all, and there
 * is no browser in the path to complete an OAuth flow. Every request would 401.
 *
 * So when MCP_SERVICE_TOKEN is set, a request arriving with NO bearer is served
 * as the user that token belongs to. The token is an ordinary Keeper API token
 * (`kpr_...`), which means:
 *   - it is revocable and expirable from Keeper's own UI, like any other token
 *   - the API already accepts it downstream — withV1Auth resolves either an API
 *     token or an MCP OAuth token — so no second credential type is introduced
 *
 * A request that DOES carry a bearer never reaches this path; it still goes
 * through the normal OAuth validation, so exposing the server publicly later
 * behaves exactly as upstream does.
 *
 * THE TRUST BOUNDARY IS THE NETWORK: anything that can reach the MCP port is
 * served as the service-token user. This must not be routed to the public
 * internet while it is set.
 */

const TOKEN_PREFIX = "kpr_";

/** Mirrors hashApiToken in services/api — the API stores a sha256 hex digest. */
const hashApiToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const isApiToken = (value: string): boolean => value.startsWith(TOKEN_PREFIX);

interface ServiceSession {
  scopes: string;
  userId: string;
  bearerToken: string;
}

/**
 * Resolves the configured service token to a session, or null when it is unset,
 * malformed, unknown or expired. Deliberately does not distinguish between
 * those: this runs on an unauthenticated path.
 */
const resolveServiceSession = async (
  database: BunSQLDatabase,
  serviceToken: string | undefined,
): Promise<ServiceSession | null> => {
  if (!serviceToken || !isApiToken(serviceToken)) {
    return null;
  }

  const [match] = await database
    .select({ userId: apiTokensTable.userId, expiresAt: apiTokensTable.expiresAt })
    .from(apiTokensTable)
    .where(eq(apiTokensTable.tokenHash, hashApiToken(serviceToken)))
    .limit(1);

  if (!match) {
    return null;
  }

  if (match.expiresAt && match.expiresAt.getTime() < Date.now()) {
    return null;
  }

  return {
    // The token carries the user's full authority at the API regardless of what
    // is claimed here, so this reflects that rather than narrowing it
    // misleadingly and failing the scope check below it.
    scopes: KEEPER_API_RESOURCE_SCOPES.join(" "),
    userId: match.userId,
    bearerToken: serviceToken,
  };
};

export { resolveServiceSession };
export type { ServiceSession };
