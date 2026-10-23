/** 상세 정보 줄 끝 링크의 주소를 만든다. 어떤 줄에 어떤 링크를 붙이는지는 ui/detail-rows.ts가 정한다(이슈 #30) */

/**
 * 카카오맵 검색결과 바로가기. 키·SDK 없이 쓰는 URL이고, 기기에 따라 PC·모바일 웹 지도가 열린다
 * (카카오 지도 Web API 가이드 "지도 URL" → "지도 검색결과 바로가기": `/link/search/검색어`).
 */
const KAKAO_MAP_SEARCH = "https://map.kakao.com/link/search/";

/** 주소 → 카카오맵 검색 URL. 검색어는 경로 한 칸이라 `/`·`?`·`#`까지 모두 인코딩한다 */
export function kakaoMapSearchUrl(address: string): string {
  return KAKAO_MAP_SEARCH + encodeURIComponent(address);
}

/** 전화번호 → `tel:` 링크. 숫자만 남긴다(하이픈·공백·괄호 제거). 숫자가 없으면 null */
export function telHref(tel: string): string | null {
  const digits = tel.replace(/\D/g, "");
  return digits ? `tel:${digits}` : null;
}
