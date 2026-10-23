import {
  ANIMAL_LIST_DEFAULTS,
  ANIMAL_LIST_SEXES,
  ANIMAL_LIST_SORTS,
  ANIMAL_LIST_STATUSES,
  ANIMAL_SPECIES,
} from "@/contract/animals";
import type { AnimalListFilter } from "@/entities/animal";
import { findSido, resolveDistrict } from "@/shared/config/regions";

/**
 * 목록 필터 ↔ URL search params(단일 진실 소스, architecture.md 7절).
 *
 * - 읽기: species, region, district, status, sex, sort만 본다. 없거나 잘못된 값은 기본값으로 본다.
 *   서버(/api/animals)는 잘못된 값을 400으로 거절하지만, 화면은 깨지지 않도록 기본값으로 보여 준다.
 * - 지역: URL에 region이 없으면 **기억된 지역**(쿠키), 그것도 없으면 기본 지역(서울 전체, 시군구 없음).
 *   region=all이면 전국(서버에 upr_cd/org_cd를 보내지 않음). region=시도코드면 그 시도, district가 그 시도의
 *   시군구면 그 시군구. 코드 목록은 정적 데이터(shared/config/regions).
 * - 쓰기: **축종과 지역은 기본값이어도 늘 URL에 쓴다.** 둘은 기억 대상(쿠키)이라 주소에서 빠지면 "기억된 값"을
 *   뜻하게 되고, 앱이 만드는 목록 주소가 생략하면 뒤로가기나 공유 링크가 그 사이 바뀐 기억에 흔들린다
 *   (architecture.md 7절, PRD-v1.1 4절). status, sex, sort는 기억 대상이 아니라 기본값과 같으면 생략한다.
 *   성별(sex)은 쿠키에 기억하지 않는다. 주소에 없으면 늘 전체다(이슈 #20).
 *   page는 URL에 넣지 않는다(커서는 useInfiniteQuery 내부 상태).
 */
/** 기본 지역: 서울특별시 전체(시군구 없음). 2026-09-28에 종로구에서 서울 전체로 넓혔다(architecture.md 7절) */
export const DEFAULT_REGION = "6110000";
/** URL에서 "전국"을 뜻하는 값 */
export const REGION_ALL = "all";

/** 기본 필터. species·status·sex·sort의 기본값은 계약(ANIMAL_LIST_DEFAULTS)이고 지역만 화면이 정한다 */
export const DEFAULT_ANIMAL_FILTER = {
  ...ANIMAL_LIST_DEFAULTS,
  region: DEFAULT_REGION,
} as const satisfies AnimalListFilter;

export const FILTER_KEYS = ["species", "region", "district", "status", "sex", "sort"] as const;

export type AnimalSpecies = AnimalListFilter["species"];

/** 아는 축종 값인지. URL 파라미터와 쿠키가 같은 판정을 쓴다 */
export function isSpecies(value: string | undefined | null): value is AnimalSpecies {
  return ANIMAL_SPECIES.includes(value as AnimalSpecies);
}

/** Next의 searchParams 객체 또는 URLSearchParams */
export type SearchParamsInput = URLSearchParams | Record<string, string | string[] | undefined>;

/** 필터의 지역 부분. region이 없으면 전국이다 */
export type AnimalArea = Pick<AnimalListFilter, "region" | "district">;

/** 기본 지역(서울 전체) */
export const DEFAULT_AREA: AnimalArea = { region: DEFAULT_REGION };

function read(params: SearchParamsInput, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

/** Next의 searchParams 객체 → URLSearchParams(값이 여럿이면 모두 살린다) */
export function toSearchParams(params: SearchParamsInput): URLSearchParams {
  if (params instanceof URLSearchParams) return new URLSearchParams(params);
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) for (const item of value) result.append(key, item);
    else if (value !== undefined) result.set(key, value);
  }
  return result;
}

/**
 * URL에 쓸 수 있는 지역이 들어 있는지. 없으면 화면은 기억된 지역(또는 기본 지역)으로 그려지는데
 * 주소에는 그 지역이 없다. 그 상태를 두지 않으려고 목록 페이지가 지역을 채워 리다이렉트한다(7절).
 */
export function hasRegionParam(params: SearchParamsInput): boolean {
  const region = read(params, "region");
  return region === REGION_ALL || findSido(region) !== null;
}

/**
 * URL에 쓸 수 있는 축종이 들어 있으면 그 값, 없거나 모르는 값이면 null.
 * 지역과 같은 이유로 주소에 축종이 없는 상태를 두지 않는다(7절). 모르는 값은 "없음"으로 본다(결정 B).
 */
export function readSpeciesParam(params: SearchParamsInput): AnimalSpecies | null {
  const value = read(params, "species");
  return isSpecies(value) ? value : null;
}

/**
 * URL의 district가 목록에서 뺀 옛 코드라 다른 코드로 읽혔는지. 그렇다면 목록 페이지가 축종·지역을 채우는 것과
 * 같은 리다이렉트에서 주소를 새 코드로 바꿔 쓴다(주소와 화면의 지역이 어긋나지 않게, 12절 41).
 */
export function hasAliasedDistrict(params: SearchParamsInput): boolean {
  const district = parseAnimalArea(params).district;
  return district !== undefined && district !== read(params, "district");
}

function pick<T extends string>(allowed: readonly T[], value: string | undefined, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * URL의 region/district → 필터의 지역. region이 없거나 목록에 없는 코드면 fallback(기억된 지역, 없으면 서울 전체).
 * district가 목록에서 뺀 옛 코드면 대신 쓰는 코드로 읽는다(`DISTRICT_ALIASES`, 12절 41).
 */
export function parseAnimalArea(params: SearchParamsInput, fallback: AnimalArea = DEFAULT_AREA): AnimalArea {
  const region = read(params, "region");
  if (region === REGION_ALL) return {};
  const sido = findSido(region);
  if (!sido) return fallback;
  const district = resolveDistrict(sido.code, read(params, "district"));
  return district ? { region: sido.code, district: district.code } : { region: sido.code };
}

/**
 * rememberedArea: URL에 지역이 없을 때 쓸 지역(쿠키에서 읽은 값). 없으면 기본 지역.
 * rememberedSpecies: URL에 축종이 없을 때 쓸 축종(쿠키에서 읽은 값). 없으면 `DEFAULT_ANIMAL_FILTER.species`인데,
 * 이 기본값은 **파서 안전망일 뿐이다**(결정 D). 목록 진입 판정은 축종이 없으면 홈으로 보낸다(`entry.ts`).
 */
export function parseAnimalFilter(
  params: SearchParamsInput,
  {
    rememberedArea,
    rememberedSpecies,
  }: { rememberedArea?: AnimalArea | null; rememberedSpecies?: AnimalSpecies | null } = {},
): AnimalListFilter {
  return {
    species: pick(ANIMAL_SPECIES, read(params, "species"), rememberedSpecies ?? DEFAULT_ANIMAL_FILTER.species),
    ...parseAnimalArea(params, rememberedArea ?? DEFAULT_AREA),
    status: pick(ANIMAL_LIST_STATUSES, read(params, "status"), DEFAULT_ANIMAL_FILTER.status),
    sex: pick(ANIMAL_LIST_SEXES, read(params, "sex"), DEFAULT_ANIMAL_FILTER.sex),
    sort: pick(ANIMAL_LIST_SORTS, read(params, "sort"), DEFAULT_ANIMAL_FILTER.sort),
  };
}

/** URL에 두지 않는 키. 누가 붙여 와도 필터를 적용할 때 지운다 */
export const FORBIDDEN_KEYS = ["page", "cursor"] as const;

/**
 * 현재 쿼리(base)에서 필터 키만 새 값으로 바꾼 쿼리 문자열("?" 없음).
 * 축종과 지역은 늘 쓰고, 나머지는 기본값이면 지운다. 필터와 무관한 파라미터(예: utm_*)는 그대로 두고 page/cursor는 지운다.
 */
export function toFilterQuery(filter: AnimalListFilter, base: URLSearchParams = new URLSearchParams()): string {
  const next = new URLSearchParams(base);
  for (const key of [...FILTER_KEYS, ...FORBIDDEN_KEYS]) next.delete(key);
  // 축종과 지역은 기본값이어도 생략하지 않는다(생략하면 기억된 값이 끼어든다)
  next.set("species", filter.species);
  next.set("region", filter.region ?? REGION_ALL);
  if (filter.district) next.set("district", filter.district);
  if (filter.status !== DEFAULT_ANIMAL_FILTER.status) next.set("status", filter.status);
  if (filter.sex !== DEFAULT_ANIMAL_FILTER.sex) next.set("sex", filter.sex);
  if (filter.sort !== DEFAULT_ANIMAL_FILTER.sort) next.set("sort", filter.sort);
  return next.toString();
}

export function toFilterHref(pathname: string, filter: AnimalListFilter, base?: URLSearchParams): string {
  const query = toFilterQuery(filter, base);
  return query ? `${pathname}?${query}` : pathname;
}
