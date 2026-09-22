import { infiniteQueryOptions, queryOptions, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { AnimalListParams, AnimalRepository } from "../model/repository";
import { animalRepository } from "./animal-repository";

/** 목록 필터. URL search params(species, region, district, status, sort)와 같다. 커서는 내부 상태라 넣지 않는다. */
export type AnimalListFilter = Omit<AnimalListParams, "cursor">;

/** 쿼리 키 팩토리. 목록 키는 필터 5종(species, region, district, status, sort)으로 정해진다(상세 → 뒤로가기 때 같은 키로 캐시를 되살린다). */
export const animalKeys = {
  all: ["animals"] as const,
  lists: () => [...animalKeys.all, "list"] as const,
  list: ({ species, region, district, status, sort }: AnimalListFilter) =>
    [...animalKeys.lists(), { species, region: region ?? null, district: district ?? null, status, sort }] as const,
  details: () => [...animalKeys.all, "detail"] as const,
  detail: (id: string) => [...animalKeys.details(), id] as const,
  byIds: (ids: readonly string[]) => [...animalKeys.all, "by-ids", [...ids]] as const,
};

export function animalsInfiniteOptions(filter: AnimalListFilter, repository: AnimalRepository = animalRepository) {
  return infiniteQueryOptions({
    queryKey: animalKeys.list(filter),
    queryFn: ({ pageParam, signal }) => repository.getAnimals({ ...filter, cursor: pageParam ?? undefined }, { signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

export function animalOptions(id: string, repository: AnimalRepository = animalRepository) {
  return queryOptions({
    queryKey: animalKeys.detail(id),
    queryFn: ({ signal }) => repository.getAnimalById(id, { signal }),
  });
}

export function animalsByIdsOptions(ids: readonly string[], repository: AnimalRepository = animalRepository) {
  return queryOptions({
    queryKey: animalKeys.byIds(ids),
    queryFn: ({ signal }) => repository.getAnimalsByIds([...ids], { signal }),
    enabled: ids.length > 0,
  });
}

/** 무한 스크롤 목록. 다음 페이지 커서는 응답의 nextCursor(null이면 끝). */
export function useAnimalsInfinite(filter: AnimalListFilter) {
  return useInfiniteQuery(animalsInfiniteOptions(filter));
}

export function useAnimal(id: string) {
  return useQuery(animalOptions(id));
}

/** 찜 목록 조회. ids가 비면 요청하지 않는다(enabled: false). */
export function useAnimalsByIds(ids: readonly string[]) {
  return useQuery(animalsByIdsOptions(ids));
}
