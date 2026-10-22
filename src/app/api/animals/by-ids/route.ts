import { ANIMAL_BY_IDS_MAX, AnimalByIdsResponseSchema } from "@/contract/animals";
import { getAnimalService } from "@/server/animals/container";
import { parseIdsQuery } from "@/server/animals/query";
import { SERVER_TUNING } from "@/server/config";
import { errorResponse, jsonResponse } from "@/server/http/respond";
import { consoleLogger } from "@/server/logger";

export async function GET(request: Request) {
  try {
    const ids = parseIdsQuery(new URL(request.url).searchParams, ANIMAL_BY_IDS_MAX);
    const body = AnimalByIdsResponseSchema.parse(await getAnimalService().getByIds(ids));
    // 일부 실패한 응답은 CDN에 남기지 않는다(다시 시도나 다음 진입이 같은 실패를 받지 않게)
    return jsonResponse(body, body.failedIds.length > 0 ? "no-store" : SERVER_TUNING.cacheControl);
  } catch (error) {
    return errorResponse(error, consoleLogger);
  }
}
