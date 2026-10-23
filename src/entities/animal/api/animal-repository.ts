import {
  ANIMAL_BY_IDS_MAX,
  AnimalByIdsResponseSchema,
  AnimalListResponseSchema,
  AnimalWireDtoSchema,
} from "@/contract/animals";
import { ApiError, getValidated } from "@/shared/api/api-request";
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
    async getAnimals({ species, region, district, status, sex, sort, cursor }, options) {
      const query = new URLSearchParams({ species, status, sort });
      if (region) query.set("region", region);
      if (region && district) query.set("district", district);
      // 전체면 보내지 않는다(성별을 고르지 않은 요청이 지금과 같은 주소 = 같은 CDN 캐시를 쓴다)
      if (sex !== "all") query.set("sex", sex);
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
     * 입력 순서를 유지하고(중복 id는 첫 번째만), 못 찾은 id는 서버처럼 조용히 빠진다.
     * 오류로 조회하지 못한 id는 failedIds에 모은다: 서버가 알려 준 id와, 요청이 실패한 청크의 id 전부(이슈 #5).
     * 하나도 불러오지 못했는데 실패가 있으면 첫 청크 오류를 던진다(전부 실패). 취소는 그대로 전달한다.
     */
    async getAnimalsByIds(ids, options) {
      const unique = [...new Set(ids)];
      // 빈 배열이면 호출하지 않는다(서버는 ids 없는 요청을 400으로 본다).
      if (unique.length === 0) return { items: [], failedIds: [] };
      const chunks = chunk(unique, ANIMAL_BY_IDS_MAX);
      const responses = await mapWithConcurrency(chunks, BY_IDS_CHUNK_CONCURRENCY, (chunkIds) =>
        getValidated(
          http,
          `${baseUrl}/api/animals/by-ids?${new URLSearchParams({ ids: chunkIds.join(",") })}`,
          AnimalByIdsResponseSchema,
          options,
        ).catch((error: unknown) => {
          if (error instanceof ApiError) return { error, failedIds: chunkIds };
          throw error;
        }),
      );
      const items = responses.flatMap((response) => ("items" in response ? response.items.map(toAnimal) : []));
      const failedIds = responses.flatMap((response) => response.failedIds);
      const firstError = responses.find((response) => "error" in response)?.error;
      // 서버는 하나도 못 불러오면 오류로 답하므로, 여기서 items가 비고 실패가 있으면 실패한 청크가 있다.
      if (items.length === 0 && firstError) throw firstError;
      return { items, failedIds };
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
