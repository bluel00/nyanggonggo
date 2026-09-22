import { SERVER_TUNING } from "@/server/config";
import { createImageProxy } from "@/server/images/image-proxy";
import { consoleLogger } from "@/server/logger";
import { createHttpClient } from "@/shared/api/http-client";

const proxyImage = createImageProxy({
  http: createHttpClient(),
  logger: consoleLogger,
  timeoutMs: SERVER_TUNING.imageProxyTimeoutMs,
  maxBytes: SERVER_TUNING.imageProxyMaxBytes,
  cacheControl: SERVER_TUNING.imageProxyCacheControl,
  fallbackCacheControl: SERVER_TUNING.imageProxyFallbackCacheControl,
});

export async function GET(request: Request) {
  return proxyImage(new URL(request.url).searchParams.get("src"));
}
