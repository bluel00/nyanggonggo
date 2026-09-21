import { AnimalListResponseSchema } from "@/contract/animals";
import { getAnimalService } from "@/server/animals/container";
import { parseListQuery } from "@/server/animals/query";
import { SERVER_TUNING } from "@/server/config";
import { errorResponse, jsonResponse } from "@/server/http/respond";
import { consoleLogger } from "@/server/logger";

export async function GET(request: Request) {
  try {
    const params = parseListQuery(new URL(request.url).searchParams);
    const body = AnimalListResponseSchema.parse(await getAnimalService().list(params));
    return jsonResponse(body, SERVER_TUNING.cacheControl);
  } catch (error) {
    return errorResponse(error, consoleLogger);
  }
}
