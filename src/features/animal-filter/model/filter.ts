import type { AnimalListFilter } from "@/entities/animal";

/**
 * 목록 필터 ↔ URL search params(단일 진실 소스, architecture.md 7절).
 *
 * - 읽기: species, region, status, sort만 본다. 없거나 잘못된 값은 기본값(cat/protected/latest)으로 본다.
 *   서버(/api/animals)는 잘못된 값을 400으로 거절하지만, 화면은 깨지지 않도록 기본값으로 보여 준다.
 * - 쓰기: 기본값과 다른 값만 URL에 넣는다(기본 상태의 URL은 `/`). 같은 필터는 항상 같은 URL과 같은 쿼리 키가 된다.
 *   page는 URL에 넣지 않는다(커서는 useInfiniteQuery 내부 상태).
 */
export const DEFAULT_ANIMAL_FILTER = {
  species: "cat",
  status: "protected",
  sort: "latest",
} as const satisfies AnimalListFilter;

export const FILTER_KEYS = ["species", "region", "status", "sort"] as const;

const SPECIES = ["cat", "dog"] as const;
const STATUSES = ["protected", "ended", "all"] as const;
const SORTS = ["latest", "endingSoon"] as const;
const REGION_PATTERN = /^\d{1,32}$/;

/** Next의 searchParams 객체 또는 URLSearchParams */
export type SearchParamsInput = URLSearchParams | Record<string, string | string[] | undefined>;

function read(params: SearchParamsInput, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function pick<T extends string>(allowed: readonly T[], value: string | undefined, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function parseAnimalFilter(params: SearchParamsInput): AnimalListFilter {
  const region = read(params, "region");
  return {
    species: pick(SPECIES, read(params, "species"), DEFAULT_ANIMAL_FILTER.species),
    ...(region && REGION_PATTERN.test(region) ? { region } : {}),
    status: pick(STATUSES, read(params, "status"), DEFAULT_ANIMAL_FILTER.status),
    sort: pick(SORTS, read(params, "sort"), DEFAULT_ANIMAL_FILTER.sort),
  };
}

/** URL에 두지 않는 키. 누가 붙여 와도 필터를 적용할 때 지운다 */
const FORBIDDEN_KEYS = ["page", "cursor"] as const;

/**
 * 현재 쿼리(base)에서 필터 키 4개만 새 값으로 바꾼 쿼리 문자열("?" 없음). 기본값은 지운다.
 * 필터와 무관한 파라미터(예: utm_*)는 그대로 두고, page/cursor는 지운다.
 */
export function toFilterQuery(filter: AnimalListFilter, base: URLSearchParams = new URLSearchParams()): string {
  const next = new URLSearchParams(base);
  for (const key of [...FILTER_KEYS, ...FORBIDDEN_KEYS]) next.delete(key);
  if (filter.species !== DEFAULT_ANIMAL_FILTER.species) next.set("species", filter.species);
  if (filter.region) next.set("region", filter.region);
  if (filter.status !== DEFAULT_ANIMAL_FILTER.status) next.set("status", filter.status);
  if (filter.sort !== DEFAULT_ANIMAL_FILTER.sort) next.set("sort", filter.sort);
  return next.toString();
}

export function toFilterHref(pathname: string, filter: AnimalListFilter, base?: URLSearchParams): string {
  const query = toFilterQuery(filter, base);
  return query ? `${pathname}?${query}` : pathname;
}

export function isSameFilter(a: AnimalListFilter, b: AnimalListFilter): boolean {
  return a.species === b.species && (a.region ?? null) === (b.region ?? null) && a.status === b.status && a.sort === b.sort;
}
