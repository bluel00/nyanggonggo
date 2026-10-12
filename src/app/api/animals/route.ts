import { AnimalListResponseSchema } from "@/contract/animals";
import { getAnimalService } from "@/server/animals/container";
import { parseListQuery } from "@/server/animals/query";
import { SERVER_TUNING } from "@/server/config";
import { errorResponse, jsonResponse } from "@/server/http/respond";
import { consoleLogger } from "@/server/logger";
import { createRequestPerf } from "@/server/perf/request-perf";

/** 요청마다 계측 로그 한 줄과 Server-Timing 헤더를 남긴다(architecture.md 12절 52) */
export async function GET(request: Request) {
  const perf = createRequestPerf("list");
  let response: Response;
  try {
    const params = parseListQuery(new URL(request.url).searchParams);
    const body = AnimalListResponseSchema.parse(await getAnimalService(perf).list(params));
    response = jsonResponse(body, SERVER_TUNING.cacheControl);
  } catch (error) {
    response = errorResponse(error, consoleLogger);
  }
  perf.finish({ status: response.status });
  response.headers.set("Server-Timing", perf.serverTiming());
  return response;
}
