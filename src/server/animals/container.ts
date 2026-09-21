import { createHttpClient } from "@/shared/api/http-client";
import { getServerConfig, SERVER_TUNING } from "../config";
import { consoleLogger } from "../logger";
import { createUpstreamAnimalSource } from "../source/upstream-source";
import { createUpstreamClient } from "../upstream/client";
import { createAnimalService, type AnimalService } from "./service";

/** 조립 지점. 요청 처리 중에 호출한다(설정을 import 시점에 읽지 않게). */
export function getAnimalService(): AnimalService {
  const { serviceKey } = getServerConfig();
  const upstream = createUpstreamClient({
    http: createHttpClient(),
    serviceKey,
    logger: consoleLogger,
    revalidateSeconds: SERVER_TUNING.upstreamRevalidateSeconds,
    timeoutMs: SERVER_TUNING.upstreamTimeoutMs,
    pageSize: SERVER_TUNING.upstreamPageSize,
    concurrency: SERVER_TUNING.upstreamConcurrency,
    maxPages: SERVER_TUNING.upstreamMaxPages,
  });
  return createAnimalService(createUpstreamAnimalSource(upstream, consoleLogger), {
    pageSize: SERVER_TUNING.listPageSize,
    byIdsConcurrency: SERVER_TUNING.byIdsConcurrency,
  });
}
