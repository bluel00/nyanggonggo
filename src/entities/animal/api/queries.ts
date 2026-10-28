import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import type { AnimalListResponse } from "@/contract/animals";
import type { Animal, AnimalPage, AnimalsByIds } from "../model/animal";
import { toAnimalPage } from "../model/mapper";
import type { AnimalListParams, AnimalRepository } from "../model/repository";
import { animalRepository } from "./animal-repository";

/** 목록 필터. URL search params(species, region, district, status, sex, sort)와 같다. 커서는 내부 상태라 넣지 않는다. */
export type AnimalListFilter = Omit<AnimalListParams, "cursor">;

/**
 * 목록 필터의 정체(이슈 #28). 필터 6종(species, region, district, status, sex, sort)만 남기고 지역이 없으면 null로 고정한다.
 * 목록 쿼리 키, 필터 비교(`isSameListFilter`), 문자열 키(`listFilterKey`)가 모두 이것으로 만든다.
 */
function listFilterIdentity({ species, region, district, status, sex, sort }: AnimalListFilter) {
  return { species, region: region ?? null, district: district ?? null, status, sex, sort };
}

/** 같은 목록인지(지역이 undefined와 없음은 같다) */
export function isSameListFilter(a: AnimalListFilter, b: AnimalListFilter): boolean {
  return listFilterKey(a) === listFilterKey(b);
}

/** 필터를 문자열 하나로(effect 의존성 등). 같은 목록이면 같은 문자열이다 */
export function listFilterKey(filter: AnimalListFilter): string {
  return JSON.stringify(listFilterIdentity(filter));
}

/** 쿼리 키 팩토리. 목록 키는 필터 6종으로 정해진다(상세 → 뒤로가기 때 같은 키로 캐시를 되살린다). */
export const animalKeys = {
  all: ["animals"] as const,
  lists: () => [...animalKeys.all, "list"] as const,
  list: (filter: AnimalListFilter) => [...animalKeys.lists(), listFilterIdentity(filter)] as const,
  details: () => [...animalKeys.all, "detail"] as const,
  detail: (id: string) => [...animalKeys.details(), id] as const,
  byIds: (ids: readonly string[]) => [...animalKeys.all, "by-ids", [...ids]] as const,
};

/**
 * 목록 캐시를 앱 메모리에 두는 시간(PRD-v1.4 R1). 상세에 다녀오는 동안 쌓인 페이지가 이만큼 남아, 그 안에 돌아오면
 * 다시 받지 않고 보던 자리로 돌아간다. 다른 쿼리는 기본값(`QUERY_GC_TIME_MS`, 5분) 그대로다.
 */
export const LIST_GC_TIME_MS = 30 * 60_000;

/**
 * 무한쿼리는 재요청을 하지 않는다(architecture.md 5절). 무한쿼리의 refetch는 쌓인 페이지를
 * **처음 커서부터 전부 순차로** 다시 받아서, 50페이지를 본 목록으로 돌아오면 /api/animals가 51번 나갔다(12절 42).
 * 받아 둔 페이지는 그대로 쓰고, 신선한 목록은 gcTime(30분)이 지나 캐시가 사라진 다음 진입에서 받는다.
 */
export function animalsInfiniteOptions(filter: AnimalListFilter, repository: AnimalRepository = animalRepository) {
  return infiniteQueryOptions({
    queryKey: animalKeys.list(filter),
    queryFn: ({ pageParam, signal }) => repository.getAnimals({ ...filter, cursor: pageParam ?? undefined }, { signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // 상세에서 돌아올 때(마운트), 공유 후 앱으로 복귀할 때(focus), 네트워크가 돌아올 때(reconnect) 모두 재요청하지 않는다.
    // 데이터가 없으면(첫 진입, 필터 변경, 새로고침) 이 설정과 무관하게 받는다.
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: LIST_GC_TIME_MS,
  });
}

export function animalOptions(id: string, repository: AnimalRepository = animalRepository) {
  return queryOptions({
    queryKey: animalKeys.detail(id),
    queryFn: ({ signal }) => repository.getAnimalById(id, { signal }),
  });
}

/**
 * 목록 카드를 누를 때 그 공고를 상세 쿼리 캐시에 미리 넣는다(architecture.md 14.2 4단계). 상세의 로딩 화면이 서버를 기다리지 않고
 * 이 데이터로 실제 상세를 그린다. 이미 있으면(최근 상세 조회) 그대로 둔다.
 *
 * 받은 시각을 30초 앞당겨 둔다: staleTime(60초) 안이라 다시 조회하지 않으면서, 서버 페이지가 넘기는 데이터(누른 뒤 서버가 조회)가
 * 서버·기기 시계가 조금 어긋나도 더 새것으로 보여 덮어쓴다(서버 데이터를 따른다).
 */
export const SEEDED_DETAIL_AGE_MS = 30_000;
export function seedAnimalDetail(queryClient: QueryClient, animal: Animal): void {
  const key = animalKeys.detail(animal.id);
  if (queryClient.getQueryData(key) !== undefined) return;
  queryClient.setQueryData(key, animal, { updatedAt: Date.now() - SEEDED_DETAIL_AGE_MS });
}

/**
 * 서버가 읽은 목록 첫 페이지(이슈 #109). 성공이면 `/api/animals` 응답과 같은 모양 그대로다(필드를 더하지 않는다).
 * 실패면 내용 없이 실패만 알린다: 목록은 지금처럼 클라이언트가 조회하고, 그것도 실패하면 목록 오류 화면이다.
 */
export type AnimalListFirstPage = { ok: true; response: AnimalListResponse } | { ok: false };

/**
 * 서버가 읽은 첫 페이지를 목록 무한쿼리 캐시에 넣는다. 그러면 목록이 첫 페이지를 위해 /api/animals를 부르지 않는다.
 * 이미 있으면(같은 목록을 30분 안에 본 적이 있음) 그대로 두고 false. 다음 페이지는 지금처럼 커서로 클라이언트가 받는다.
 */
export function seedAnimalsFirstPage(queryClient: QueryClient, filter: AnimalListFilter, response: AnimalListResponse): boolean {
  const key = animalKeys.list(filter);
  if (queryClient.getQueryData(key) !== undefined) return false;
  queryClient.setQueryData<InfiniteData<AnimalPage, string | null>>(key, { pages: [toAnimalPage(response)], pageParams: [null] });
  return true;
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

/**
 * 찜 목록에서 오류로 받지 못한 공고만 다시 받아 그 ids의 by-ids 캐시에 합친다(이슈 #5).
 * 이미 받은 공고는 다시 받지 않는다. 다시 받다가 전부 실패하면 캐시를 그대로 두고 mutation이 오류가 된다.
 */
export function useRetryFailedAnimals(repository: AnimalRepository = animalRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ failedIds }: { ids: readonly string[]; failedIds: string[] }) =>
      repository.getAnimalsByIds(failedIds),
    onSuccess: (retried, { ids, failedIds }) => {
      queryClient.setQueryData<AnimalsByIds>(animalKeys.byIds(ids), (current) =>
        current ? mergeRetried(ids, current, failedIds, retried) : current,
      );
    },
  });
}

/** 다시 받은 결과를 ids 순서대로 끼워 넣는다. 다시 요청하지 않은 실패는 그대로 남긴다 */
function mergeRetried(
  ids: readonly string[],
  current: AnimalsByIds,
  requested: readonly string[],
  retried: AnimalsByIds,
): AnimalsByIds {
  const byId = new Map([...current.items, ...retried.items].map((animal) => [animal.id, animal]));
  return {
    items: [...new Set(ids)].flatMap((id) => byId.get(id) ?? []),
    failedIds: [...current.failedIds.filter((id) => !requested.includes(id)), ...retried.failedIds],
  };
}
