import { isSpecies, type AnimalSpecies } from "./filter";
import { writeFilterCookie } from "./filter-cookie";

/**
 * 마지막으로 고른 축종을 기억한다(PRD-v1.1 3절 8), architecture.md 7절).
 *
 * 속성과 저장 시점은 지역 쿠키와 같다(`filter-cookie.ts`): 사용자가 필터 시트에서 적용하거나
 * 홈에서 축종을 고를 때만 저장하고, 공유 링크로 들어온 상세의 뒤로가기(focus 흐름)에서는 저장하지 않는다.
 * 남이 공유한 강아지 공고를 봤다고 내 기본 축종이 강아지가 되면 안 된다.
 *
 * 값은 축종 코드 하나뿐이다(`cat` | `dog` | `other`). 이 쿠키가 있으면 `/`로 들어와도 홈을 건너뛴다.
 */
export const SPECIES_COOKIE = "nyanggonggo.species";

/** 쿠키 값 → 축종. 모르는 값이면 null(조용히 무시하고 홈으로 간다) */
export function parseSpeciesCookie(value: string | undefined | null): AnimalSpecies | null {
  return isSpecies(value) ? value : null;
}

/** 브라우저에 기억시킨다. 사용자가 직접 고른 경우에만 부른다 */
export function rememberSpecies(species: AnimalSpecies): void {
  writeFilterCookie(SPECIES_COOKIE, species);
}
