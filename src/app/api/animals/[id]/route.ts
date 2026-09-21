import { AnimalWireDtoSchema } from "@/contract/animals";
import { getAnimalService } from "@/server/animals/container";
import { parseAnimalId } from "@/server/animals/query";
import { SERVER_TUNING } from "@/server/config";
import { errorResponse, jsonResponse } from "@/server/http/respond";
import { consoleLogger } from "@/server/logger";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseAnimalId((await params).id);
    const body = AnimalWireDtoSchema.parse(await getAnimalService().getById(id));
    return jsonResponse(body, SERVER_TUNING.cacheControl);
  } catch (error) {
    return errorResponse(error, consoleLogger);
  }
}
