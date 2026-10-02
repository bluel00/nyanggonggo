import type { AnimalListFilter } from "@/entities/animal";
import {
  DEFAULT_AREA,
  FORBIDDEN_KEYS,
  hasRegionParam,
  parseAnimalArea,
  parseAnimalFilter,
  readSpeciesParam,
  REGION_ALL,
  toFilterHref,
  toSearchParams,
  type AnimalArea,
  type SearchParamsInput,
} from "./filter";
import { readFocusId } from "./from-animal";
import { parseRegionCookie } from "./region-cookie";
import { parseSpeciesCookie } from "./species-cookie";

/** 홈(축종 선택) 화면의 경로 */
export const HOME_PATH = "/home";

/** `/`로 들어왔을 때 할 일: 이 필터로 목록을 그리거나, 이 주소로 리다이렉트한다 */
export type AnimalListEntry =
  | { kind: "render"; filter: AnimalListFilter; focusId: string | null }
  | { kind: "redirect"; href: string };

/** 기억 쿠키의 날값(`cookies().get(...)?.value`). 없으면 기억이 없는 것이다 */
export type RememberedFilterCookies = { species?: string | null; region?: string | null };

/**
 * `/`(목록) 진입 판정. 순수 함수다: searchParams와 기억 쿠키 둘만 보고 "그린다" 또는 "리다이렉트한다"를 돌려준다
 * (architecture.md 7절, PRD-v1.1 4절). 쿠키를 읽고 `redirect()`를 던지는 일은 `app/page.tsx`가 한다.
 *
 * 판정은 **축종이 먼저**다(결정 B):
 * 1. URL에 쓸 수 있는 `species`가 있으면 그 축종이다. 없거나 모르는 값(`panda`)이면 "없음"으로 본다.
 * 2. 없으면 축종 쿠키를 쓴다. 쿠키도 없으면 홈(`/home`)으로 보내고 **지역은 판정하지 않는다**.
 * 3. 축종이 정해졌으면 지역까지 맞춰 보고, 주소에 채울 값이 있으면 **한 번의 리다이렉트로 둘 다** 채운다.
 *
 * `focus`, `utm_*` 같은 다른 파라미터는 어느 쪽으로 가든 그대로 옮긴다. `page`/`cursor`와 모르는 `species` 값은 버린다.
 */
export function resolveAnimalListEntry(
  params: SearchParamsInput,
  cookies: RememberedFilterCookies = {},
): AnimalListEntry {
  const base = toSearchParams(params);
  const urlSpecies = readSpeciesParam(params);
  const species = urlSpecies ?? parseSpeciesCookie(cookies.species);

  // 축종을 모르면 무엇을 보여 줄지 정할 수 없다. 홈에서 고르게 한다(기본 축종으로 밀어 넣지 않는다, 결정 D)
  if (species === null) return { kind: "redirect", href: toHomePath(base) };

  const filter = parseAnimalFilter(params, {
    rememberedArea: parseRegionCookie(cookies.region),
    rememberedSpecies: species,
  });

  // 보여 주는 목록은 주소만으로 다시 열 수 있어야 한다. 축종이나 지역이 빠져 있으면 채워서 한 번에 보낸다
  if (urlSpecies === null || !hasRegionParam(params)) {
    return { kind: "redirect", href: toFilterHref("/", filter, base) };
  }
  return { kind: "render", filter, focusId: readFocusId(params) };
}

/** 홈으로 보낼 주소. 쓸 수 없는 축종 값과 내부 키만 버리고 나머지(지역, focus, utm_*)는 그대로 옮긴다 */
function toHomePath(base: URLSearchParams): string {
  const next = new URLSearchParams(base);
  for (const key of ["species", ...FORBIDDEN_KEYS]) next.delete(key);
  const query = next.toString();
  return query ? `${HOME_PATH}?${query}` : HOME_PATH;
}

/**
 * 목록에서 홈으로 가는 주소(결정 G2). 보고 있던 지역을 넘겨 줘서, 홈에서 축종을 고르면 같은 지역의 목록으로 간다.
 * 축종은 넘기지 않는다(홈에서 새로 고르는 값이다).
 */
export function homeHref(area: AnimalArea): string {
  const params = new URLSearchParams({ region: area.region ?? REGION_ALL });
  if (area.district) params.set("district", area.district);
  return `${HOME_PATH}?${params.toString()}`;
}

/**
 * 홈이 쓸 지역(결정 G2): 목록에서 넘겨받은 지역이 유효하면 그 지역, 아니면 기억된 지역, 그것도 없으면 서울 전체.
 * 홈은 축종만 기억하므로 이 지역은 쿠키에 쓰지 않는다.
 */
export function resolveHomeArea(params: SearchParamsInput, regionCookie?: string | null): AnimalArea {
  return parseAnimalArea(params, parseRegionCookie(regionCookie) ?? DEFAULT_AREA);
}
