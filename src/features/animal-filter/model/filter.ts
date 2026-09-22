import type { AnimalListFilter } from "@/entities/animal";
import { findDistrict, findSido } from "@/shared/config/regions";

/**
 * 목록 필터 ↔ URL search params(단일 진실 소스, architecture.md 7절).
 *
 * - 읽기: species, region, district, status, sort만 본다. 없거나 잘못된 값은 기본값으로 본다.
 *   서버(/api/animals)는 잘못된 값을 400으로 거절하지만, 화면은 깨지지 않도록 기본값으로 보여 준다.
 * - 지역: URL에 region이 없으면 기본 지역(서울/종로구). region=all이면 전국(서버에 upr_cd/org_cd를 보내지 않음).
 *   region=시도코드면 그 시도, district가 그 시도의 시군구면 그 시군구. 코드 목록은 정적 데이터(shared/config/regions).
 * - 쓰기: 기본값과 같은 값은 URL에서 생략한다(기본 상태의 URL은 `/`). 전국은 기본값이 아니므로 region=all로 남긴다.
 *   page는 URL에 넣지 않는다(커서는 useInfiniteQuery 내부 상태).
 */
export const DEFAULT_REGION = "6110000"; // 서울특별시
export const DEFAULT_DISTRICT = "3000000"; // 종로구
/** URL에서 "전국"을 뜻하는 값 */
export const REGION_ALL = "all";

export const DEFAULT_ANIMAL_FILTER = {
  species: "cat",
  region: DEFAULT_REGION,
  district: DEFAULT_DISTRICT,
  status: "protected",
  sort: "latest",
} as const satisfies AnimalListFilter;

export const FILTER_KEYS = ["species", "region", "district", "status", "sort"] as const;

const SPECIES = ["cat", "dog"] as const;
const STATUSES = ["protected", "ended", "all"] as const;
const SORTS = ["latest", "endingSoon"] as const;

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

/** URL의 region/district → 필터의 지역. region이 없거나 목록에 없는 코드면 기본 지역 */
function parseArea(params: SearchParamsInput): Pick<AnimalListFilter, "region" | "district"> {
  const region = read(params, "region");
  if (region === REGION_ALL) return {};
  const sido = findSido(region);
  if (!sido) return { region: DEFAULT_REGION, district: DEFAULT_DISTRICT };
  const district = findDistrict(sido.code, read(params, "district"));
  return district ? { region: sido.code, district: district.code } : { region: sido.code };
}

export function parseAnimalFilter(params: SearchParamsInput): AnimalListFilter {
  return {
    species: pick(SPECIES, read(params, "species"), DEFAULT_ANIMAL_FILTER.species),
    ...parseArea(params),
    status: pick(STATUSES, read(params, "status"), DEFAULT_ANIMAL_FILTER.status),
    sort: pick(SORTS, read(params, "sort"), DEFAULT_ANIMAL_FILTER.sort),
  };
}

/** URL에 두지 않는 키. 누가 붙여 와도 필터를 적용할 때 지운다 */
const FORBIDDEN_KEYS = ["page", "cursor"] as const;

function isDefaultArea(filter: AnimalListFilter): boolean {
  return filter.region === DEFAULT_REGION && filter.district === DEFAULT_DISTRICT;
}

/**
 * 현재 쿼리(base)에서 필터 키만 새 값으로 바꾼 쿼리 문자열("?" 없음). 기본값은 지운다.
 * 필터와 무관한 파라미터(예: utm_*)는 그대로 두고, page/cursor는 지운다.
 */
export function toFilterQuery(filter: AnimalListFilter, base: URLSearchParams = new URLSearchParams()): string {
  const next = new URLSearchParams(base);
  for (const key of [...FILTER_KEYS, ...FORBIDDEN_KEYS]) next.delete(key);
  if (filter.species !== DEFAULT_ANIMAL_FILTER.species) next.set("species", filter.species);
  if (!filter.region) next.set("region", REGION_ALL);
  else if (!isDefaultArea(filter)) {
    next.set("region", filter.region);
    if (filter.district) next.set("district", filter.district);
  }
  if (filter.status !== DEFAULT_ANIMAL_FILTER.status) next.set("status", filter.status);
  if (filter.sort !== DEFAULT_ANIMAL_FILTER.sort) next.set("sort", filter.sort);
  return next.toString();
}

export function toFilterHref(pathname: string, filter: AnimalListFilter, base?: URLSearchParams): string {
  const query = toFilterQuery(filter, base);
  return query ? `${pathname}?${query}` : pathname;
}

export function isSameFilter(a: AnimalListFilter, b: AnimalListFilter): boolean {
  return (
    a.species === b.species &&
    (a.region ?? null) === (b.region ?? null) &&
    (a.district ?? null) === (b.district ?? null) &&
    a.status === b.status &&
    a.sort === b.sort
  );
}
