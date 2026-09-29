import { findDistrict, findSido } from "@/shared/config/regions";
import { REGION_ALL, type AnimalArea } from "./filter";

/**
 * 마지막으로 고른 지역을 기억한다(architecture.md 7절, 13절 (a)).
 *
 * localStorage가 아니라 쿠키인 이유: 서버가 첫 렌더에서 바로 그 지역 목록을 그리기 위해서다.
 * localStorage면 서울 목록을 그린 뒤 클라이언트에서 바꿔야 해서 화면이 한 번 깜빡이고 목록 요청도 두 번 나간다.
 *
 * 값은 지역 코드뿐이다: `all`(전국), `<시도>`, `<시도>.<시군구>`. 민감한 정보가 아니라 클라이언트에서 설정한다.
 */
export const REGION_COOKIE = "nyanggonggo.region";
/** 1년 */
export const REGION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** 쿠키 값 → 지역. 형식이 깨졌거나 목록에 없는 코드면 null(조용히 무시하고 기본 지역으로 간다) */
export function parseRegionCookie(value: string | undefined | null): AnimalArea | null {
  if (!value) return null;
  if (value === REGION_ALL) return {};

  const [region, district, ...rest] = value.split(".");
  if (rest.length > 0) return null;
  const sido = findSido(region);
  if (!sido) return null;
  if (district === undefined) return { region: sido.code };

  const found = findDistrict(sido.code, district);
  return found ? { region: sido.code, district: found.code } : null;
}

/** 지역 → 쿠키 값 */
export function formatRegionCookie(area: AnimalArea): string {
  if (!area.region) return REGION_ALL;
  return area.district ? `${area.region}.${area.district}` : area.region;
}

/** 브라우저에 기억시킨다. 사용자가 필터 UI에서 직접 고른 경우에만 부른다(공유 링크로 온 지역은 기억하지 않는다) */
export function rememberRegion(area: AnimalArea): void {
  const value = encodeURIComponent(formatRegionCookie(area));
  document.cookie = `${REGION_COOKIE}=${value}; path=/; max-age=${REGION_COOKIE_MAX_AGE}; SameSite=Lax`;
}
