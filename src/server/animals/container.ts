import { createHttpClient } from "@/shared/api/http-client";
import { getServerConfig, SERVER_TUNING } from "../config";
import { consoleLogger } from "../logger";
import type { PageCacheObserver } from "../perf/request-perf";
import { createUpstreamAnimalSource } from "../source/upstream-source";
import { createUpstreamClient } from "../upstream/client";
import { createNextPageCache } from "../upstream/next-page-cache";
import { createAnimalService, type AnimalService } from "./service";

/**
 * 조립 지점. 요청 처리 중에 호출한다(설정을 import 시점에 읽지 않게).
 * perf를 주면 업스트림 페이지 캐시의 시간과 적중 여부를 기록한다(architecture.md 12절 52).
 */
export function getAnimalService(perf?: PageCacheObserver): AnimalService {
  const { serviceKey } = getServerConfig();
  const pageCache = createNextPageCache(SERVER_TUNING.upstreamRevalidateSeconds);
  const upstream = createUpstreamClient({
    http: createHttpClient(),
    serviceKey,
    logger: consoleLogger,
    pageCache: perf ? perf.observePageCache(pageCache) : pageCache,
    timeoutMs: SERVER_TUNING.upstreamTimeoutMs,
    pageSize: SERVER_TUNING.upstreamPageSize,
    concurrency: SERVER_TUNING.upstreamConcurrency,
    maxPages: SERVER_TUNING.upstreamMaxPages,
  });
  return createAnimalService(createUpstreamAnimalSource(upstream, consoleLogger), {
    pageSize: SERVER_TUNING.listPageSize,
    byIdsConcurrency: SERVER_TUNING.byIdsConcurrency,
    now: () => new Date(),
    logger: consoleLogger,
  });
}
