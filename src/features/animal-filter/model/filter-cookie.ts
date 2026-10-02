/**
 * 필터를 기억하는 쿠키의 공통 속성. 지역(`nyanggonggo.region`)과 축종(`nyanggonggo.species`)이
 * 같은 규칙을 쓴다(architecture.md 7절).
 *
 * localStorage가 아니라 쿠키인 이유는 두 값이 같다: 서버(`app/page.tsx`)가 첫 렌더부터 그 값으로 그려야
 * 화면이 깜빡이지 않고 목록 요청도 한 번만 나간다.
 */

/** 1년 */
export const FILTER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** 브라우저에 기억시킨다. 사용자가 직접 고른 경우에만 부른다(공유 링크로 온 값은 기억하지 않는다, 7절) */
export function writeFilterCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${FILTER_COOKIE_MAX_AGE}; SameSite=Lax`;
}
