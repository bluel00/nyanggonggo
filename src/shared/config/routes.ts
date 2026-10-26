/**
 * 페이지 경로(#73). 앱의 주소 체계이고 동물 도메인의 규칙이 아니다. 실제 라우트는 app 디렉터리가 정하고, 여기 경로와 맞는지는
 * E2E(e2e/routes.spec.ts)가 본다. src에서 페이지 경로 문자열을 만드는 코드는 모두 이 함수를 쓴다.
 *
 * 맡는 것: 페이지의 상대 경로와, 이미 직렬화된 쿼리를 붙이는 일. 절대 주소는 `siteOrigin()`(site-origin.ts) + 이 경로다.
 * 맡지 않는 것: 쿼리 직렬화(어떤 키를 어떻게 쓰는지, 목록은 features/animal-filter의 toFilterQuery), 권한, 상태별 이동, 공유 정책.
 *
 * 목록(`/` + 쿼리), 홈(`/home`), 진입 경로(쿼리 없는 `/`)는 이름으로 구분한다. 진입 경로와 목록은 값이 같아도 다른 개념이다:
 * 진입 경로는 기억한 목록이 있으면 그 목록, 없으면 홈으로 보내는 곳이다(용어 사전 "진입 경로", PRD-v1.4 R2).
 * id는 문자열로 받는다(shared는 entities 타입을 가져오지 않는다).
 */

/** 이미 직렬화된 쿼리. URLSearchParams이거나 "?" 없는 문자열 */
export type RouteQuery = URLSearchParams | string;

function withQuery(pathname: string, query?: RouteQuery): string {
  const text = query === undefined ? "" : query.toString();
  return text ? `${pathname}?${text}` : pathname;
}

export const routes = {
  /** 진입 경로: 쿼리 없는 `/` */
  entry: () => "/",
  /** 목록: `/` + 목록 쿼리 */
  list: (query: RouteQuery) => withQuery("/", query),
  /** 홈(축종 선택) */
  home: (query?: RouteQuery) => withQuery("/home", query),
  /** 관심 목록 */
  favorites: () => "/favorites",
  /** 공고 상세 */
  detail: (id: string) => `/animals/${id}`,
  /** 사이트 OG 이미지(app/opengraph-image.tsx) */
  ogImage: () => "/opengraph-image",
  /** 상세 OG 이미지(app/animals/[id]/opengraph-image.tsx) */
  detailOgImage: (id: string) => `/animals/${id}/opengraph-image`,
} as const;
