import { AnimalByIdsResponseSchema } from "@/contract/animals";
import { getAnimalService } from "@/server/animals/container";
import { parseIdsQuery } from "@/server/animals/query";
import { SERVER_TUNING } from "@/server/config";
import { errorResponse, jsonResponse } from "@/server/http/respond";
import { consoleLogger } from "@/server/logger";

export async function GET(request: Request) {
  try {
    const ids = parseIdsQuery(new URL(request.url).searchParams, SERVER_TUNING.byIdsMax);
    const body = AnimalByIdsResponseSchema.parse({ items: await getAnimalService().getByIds(ids) });
    return jsonResponse(body, SERVER_TUNING.cacheControl);
  } catch (error) {
    return errorResponse(error, consoleLogger);
  }
}
