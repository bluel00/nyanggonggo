import type { Animal, AnimalListFilter } from "@/entities/animal";
import { DISTRICTS, SIDO } from "@/shared/config/regions";
import { DEFAULT_ANIMAL_FILTER, toFilterHref, type SearchParamsInput } from "./filter";

/**
 * 공고 하나로 "그 공고가 들어 있는 목록"의 필터를 만든다(공유 링크로 상세에 바로 들어온 사람의 뒤로가기용).
 *
 * 업스트림 응답에는 지역 **코드**가 없고 기관 이름(`orgNm`)만 있다. 실측(2026-09-29) 결과 `orgNm`은
 * `"<시도명> <시군구명>"`이고 목록 필터(`upr_cd`/`org_cd`)의 기준과 같은 값을 가리킨다(architecture.md 4절).
 * 그래서 Domain의 `regionText`(= `orgNm`)에서 정적 지역 목록으로 코드를 되찾는다.
 *
 * 폴백: 시군구를 못 찾으면 시도만, 시도도 못 찾으면 지역 전체(전국). 종과 상태는 공고 값을 그대로 쓰고
 * 정렬은 기본값이다.
 */
export function animalListFilter(animal: Animal): AnimalListFilter {
  return {
    species: animal.species,
    ...areaFromRegionText(animal.regionText),
    status: animal.status,
    sort: DEFAULT_ANIMAL_FILTER.sort,
  };
}

/** URL에서 "이 공고로 스크롤해 달라"는 뜻의 키. 처리한 뒤에는 목록이 URL에서 지운다 */
export const FOCUS_KEY = "focus";

/** 공고 id 형식(desertionNo)만 받는다 */
const ID_PATTERN = /^\d{1,32}$/;

/** URL의 focus 값. 형식이 아니면 null */
export function readFocusId(params: SearchParamsInput): string | null {
  const value = params instanceof URLSearchParams ? params.get(FOCUS_KEY) : params[FOCUS_KEY];
  const id = Array.isArray(value) ? value[0] : value;
  return id && ID_PATTERN.test(id) ? id : null;
}

/** 그 공고가 들어 있는 목록 주소 + focus. 기본값 생략 규칙은 toFilterHref가 지킨다 */
export function animalListHref(animal: Animal): string {
  const focus = new URLSearchParams({ [FOCUS_KEY]: animal.id });
  return toFilterHref("/", animalListFilter(animal), focus);
}

/**
 * `"서울특별시 종로구"` → `{ region: "6110000", district: "3000000" }`.
 *
 * 시군구 이름은 통째로 맞춰 보고, 안 되면 뒤 토큰부터 앞 토큰까지 하나씩 맞춰 본다
 * (`"경기도 수원시 권선구"`처럼 시 아래 구가 오는 형식 때문. 실측 예: `"경상남도 창원시 의창성산구"`).
 */
function areaFromRegionText(regionText: string): Pick<AnimalListFilter, "region" | "district"> {
  const text = regionText.trim();
  const sido = SIDO.find((candidate) => text.startsWith(candidate.name));
  if (!sido) return {}; // 전국

  const rest = text.slice(sido.name.length).trim();
  if (!rest) return { region: sido.code }; // 세종, 제주처럼 시군구가 없는 경우

  const districts = DISTRICTS[sido.code] ?? [];
  // 통째로 → 뒤 토큰(구) → 앞 토큰(시) 순으로 맞춰 본다
  const candidates = [rest, ...rest.split(/\s+/).reverse()];
  for (const name of candidates) {
    const district = districts.find((candidate) => candidate.name === name);
    if (district) return { region: sido.code, district: district.code };
  }
  return { region: sido.code };
}
