import { entry } from "entrykit";
import { join } from "node:path";
import { normalizeBasePath, stripBasePathFromRequest } from "@keeper.sh/constants";
import { tryLoadMcpEnv } from "./env";
import { isHttpMethod, isRouteModule } from "./utils/route-handler";
import { destroy } from "./utils/logging";

const env = tryLoadMcpEnv();

if (!env) {
  process.exit(0);
}

const HTTP_NOT_FOUND = 404;
const HTTP_METHOD_NOT_ALLOWED = 405;
const HTTP_INTERNAL_SERVER_ERROR = 500;

const basePath = normalizeBasePath(env.BASE_PATH);

const router = new Bun.FileSystemRouter({
  dir: join(import.meta.dirname, "routes"),
  style: "nextjs",
});

await entry({
  main: () => {
    const server = Bun.serve({
      // Bun's dev error page renders the thrown error, leaking query text and bound parameters.
      development: false,
      port: env.MCP_PORT,
      fetch: async (incomingRequest) => {
        // Strip the path prefix once at the edge so the FileSystemRouter keeps
        // matching the root-relative "/mcp" and "/health" routes. No-op when
        // BASE_PATH is unset, and left alone for requests that arrive without
        // the prefix (in-cluster callers and health probes address the pod
        // directly).
        const request = stripBasePathFromRequest(incomingRequest, basePath);
        const match = router.match(request);

        if (!match) {
          return new Response("Not found", { status: HTTP_NOT_FOUND });
        }

        const module: unknown = await import(match.filePath);

        if (!isRouteModule(module)) {
          return new Response("Internal server error", {
            status: HTTP_INTERNAL_SERVER_ERROR,
          });
        }

        if (!isHttpMethod(request.method)) {
          return new Response("Method not allowed", { status: HTTP_METHOD_NOT_ALLOWED });
        }

        const handler = module[request.method];

        if (!handler) {
          return new Response("Method not allowed", { status: HTTP_METHOD_NOT_ALLOWED });
        }

        return handler(request);
      },
    });

    return async () => {
      server.stop();
      await destroy();
    };
  },
  name: "mcp",
});
