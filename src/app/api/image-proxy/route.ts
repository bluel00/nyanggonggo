import { SERVER_TUNING } from "@/server/config";
import { createImageProxy } from "@/server/images/image-proxy";
import { createSharpResizer } from "@/server/images/resize-image";
import { consoleLogger } from "@/server/logger";
import { createHttpClient } from "@/shared/api/http-client";

const proxyImage = createImageProxy({
  http: createHttpClient(),
  logger: consoleLogger,
  timeoutMs: SERVER_TUNING.imageProxyTimeoutMs,
  maxBytes: SERVER_TUNING.imageProxyMaxBytes,
  cacheControl: SERVER_TUNING.imageProxyCacheControl,
  fallbackCacheControl: SERVER_TUNING.imageProxyFallbackCacheControl,
  resize: createSharpResizer(SERVER_TUNING.imageProxyWebpQuality),
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return proxyImage(params.get("src"), params.get("w"));
}
