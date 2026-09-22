import {
  ANIMAL_BY_IDS_MAX,
  AnimalByIdsResponseSchema,
  AnimalListResponseSchema,
  AnimalWireDtoSchema,
} from "@/contract/animals";
import { getValidated } from "@/shared/api/api-request";
import { createHttpClient, type HttpClient } from "@/shared/api/http-client";
import { mapWithConcurrency } from "@/shared/lib/concurrency";
import { toAnimal } from "../model/mapper";
import type { AnimalRepository } from "../model/repository";

/** by-ids를 여러 번 나눠 보낼 때 동시 요청 수 */
export const BY_IDS_CHUNK_CONCURRENCY = 3;

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

    /**
     * ids가 상한(ANIMAL_BY_IDS_MAX)을 넘으면 상한 단위로 나눠 동시에 최대 BY_IDS_CHUNK_CONCURRENCY개씩 요청하고 합친다.
     * 입력 순서를 유지하고(중복 id는 첫 번째만), 못 찾은 id는 서버처럼 조용히 빠진다. 한 청크라도 실패하면 전체가 실패한다.
     */
    async getAnimalsByIds(ids, options) {
      const unique = [...new Set(ids)];
      // 빈 배열이면 호출하지 않는다(서버는 ids 없는 요청을 400으로 본다).
      if (unique.length === 0) return [];
      const chunks = chunk(unique, ANIMAL_BY_IDS_MAX);
      const responses = await mapWithConcurrency(chunks, BY_IDS_CHUNK_CONCURRENCY, (chunkIds) =>
        getValidated(
          http,
          `${baseUrl}/api/animals/by-ids?${new URLSearchParams({ ids: chunkIds.join(",") })}`,
          AnimalByIdsResponseSchema,
          options,
        ),
      );
      return responses.flatMap((response) => response.items.map(toAnimal));
    },
  };
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

/** 앱에서 쓰는 기본 인스턴스(같은 origin의 /api/**) */
export const animalRepository = createAnimalRepository();
