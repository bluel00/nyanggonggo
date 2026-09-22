import { AnimalByIdsResponseSchema, AnimalListResponseSchema, AnimalWireDtoSchema } from "@/contract/animals";
import { getValidated } from "@/shared/api/api-request";
import { createHttpClient, type HttpClient } from "@/shared/api/http-client";
import { toAnimal } from "../model/mapper";
import type { AnimalRepository } from "../model/repository";

export type AnimalRepositoryOptions = {
  http?: HttpClient;
  /** 기본은 같은 origin("") */
  baseUrl?: string;
};

/**
 * AnimalRepository 어댑터. 자체 /api/**를 호출하고, 응답을 계약(Zod)으로 검증한 뒤 클라이언트 Mapper로 Domain을 돌려준다.
 * 실패는 ApiError(shared/api/api-request)로 던진다.
 */
export function createAnimalRepository({
  http = createHttpClient(),
  baseUrl = "",
}: AnimalRepositoryOptions = {}): AnimalRepository {
  return {
    async getAnimals({ species, region, status, sort, cursor }, options) {
      const query = new URLSearchParams({ species, status, sort });
      if (region) query.set("region", region);
      if (cursor) query.set("cursor", cursor);
      const response = await getValidated(http, `${baseUrl}/api/animals?${query}`, AnimalListResponseSchema, options);
      return { items: response.items.map(toAnimal), nextCursor: response.nextCursor };
    },

    async getAnimalById(id, options) {
      const wire = await getValidated(
        http,
        `${baseUrl}/api/animals/${encodeURIComponent(id)}`,
        AnimalWireDtoSchema,
        options,
      );
      return toAnimal(wire);
    },

    async getAnimalsByIds(ids, options) {
      // 빈 배열이면 호출하지 않는다(서버는 ids 없는 요청을 400으로 본다).
      if (ids.length === 0) return [];
      const query = new URLSearchParams({ ids: ids.join(",") });
      const response = await getValidated(
        http,
        `${baseUrl}/api/animals/by-ids?${query}`,
        AnimalByIdsResponseSchema,
        options,
      );
      return response.items.map(toAnimal);
    },
  };
}

/** 앱에서 쓰는 기본 인스턴스(같은 origin의 /api/**) */
export const animalRepository = createAnimalRepository();
