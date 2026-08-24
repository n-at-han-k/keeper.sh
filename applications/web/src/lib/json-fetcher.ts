import { joinBasePath } from "@keeper.sh/constants";
import { HttpError, readHttpErrorBody } from "./fetcher";
import { BASE_PATH } from "./base-path";
import type { AppJsonFetcher } from "./router-context";

function createJsonFetcher(
  requestCookie: string | null,
  origin: string,
): AppJsonFetcher {
  return async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const requestHeaders = new Headers(init.headers);
    if (requestCookie && !requestHeaders.has("cookie")) {
      requestHeaders.set("cookie", requestCookie);
    }

    // `origin` carries no path, and `new URL("/api/x", origin)` would resolve
    // to the root regardless of any prefix, so the prefix is joined on here.
    // Upstream targets receive it and strip it themselves (see BASE_PATH in
    // packages/constants), which keeps this correct whether the request goes to
    // the gateway or straight to the API service.
    const absoluteUrl = new URL(joinBasePath(path, BASE_PATH), origin).toString();
    const response = await fetch(absoluteUrl, {
      ...init,
      credentials: "include",
      headers: requestHeaders,
    });

    if (!response.ok) {
      throw new HttpError(response.status, path, await readHttpErrorBody(response));
    }

    return response.json() as Promise<T>;
  };
}

export { createJsonFetcher };
