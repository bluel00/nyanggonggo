/**
 * 이미지 프록시 계약. 서버 라우트(/api/image-proxy)와 클라이언트(카드 img src)가 함께 쓴다.
 * 원본은 공공 API 이미지 서버(http)만 허용한다. 그 외를 받으면 오픈 프록시가 된다.
 */
export const IMAGE_PROXY_PATH = "/api/image-proxy";

/** 허용하는 원본 URL 접두어. 끝의 `/`까지 포함해 호스트를 고정한다. */
export const IMAGE_SOURCE_PREFIX = "http://openapi.animal.go.kr/";

/** 접두어와 URL 파싱 결과(프로토콜, 호스트, 포트, 사용자 정보)를 모두 확인한다. */
export function isAllowedImageSource(src: string): boolean {
  if (!src.startsWith(IMAGE_SOURCE_PREFIX)) return false;
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return false;
  }
  return (
    url.protocol === "http:" &&
    url.hostname === "openapi.animal.go.kr" &&
    url.port === "" &&
    url.username === "" &&
    url.password === ""
  );
}

/**
 * 프록시가 줄여 주는 폭(px)의 허용 목록. 이 밖의 `w`는 400이다(임의 크기 변환 남용과 CDN 캐시 키 폭발 방지).
 *
 * 근거(architecture.md 5절): 카드는 컬럼(최대 480) − 좌우 여백 32 = 358~448px, 상세 캐러셀은 컬럼 전체 390~480px다.
 * 390px 폰 DPR 2에서 카드 716 / 상세 780 → 둘 다 828, DPR 3에서 1074 / 1170 → 둘 다 1080, PC 480 컬럼 DPR 1에서
 * 448 / 480 → 둘 다 480, DPR 2에서 896 / 960 → 둘 다 1080. 목록과 상세가 같은 URL을 골라 상세 첫 사진이 브라우저 캐시에서 나온다.
 */
export const IMAGE_PROXY_WIDTHS = [480, 828, 1080] as const;
export type ImageProxyWidth = (typeof IMAGE_PROXY_WIDTHS)[number];

export function isImageProxyWidth(value: number): value is ImageProxyWidth {
  return (IMAGE_PROXY_WIDTHS as readonly number[]).includes(value);
}

/** 카드 img src. 허용되지 않은 원본이면 null(대체 UI). width가 없으면 원본 그대로(뷰어, 공유 이미지) */
export function toImageProxyUrl(src: string, width?: ImageProxyWidth): string | null {
  if (!isAllowedImageSource(src)) return null;
  const params = new URLSearchParams({ src });
  if (width !== undefined) params.set("w", String(width));
  return `${IMAGE_PROXY_PATH}?${params}`;
}

/** 허용 폭 전부로 만든 srcset(`… 480w, … 828w, … 1080w`). 허용되지 않은 원본이면 null */
export function toImageProxySrcSet(src: string): string | null {
  if (!isAllowedImageSource(src)) return null;
  return IMAGE_PROXY_WIDTHS.map((width) => `${toImageProxyUrl(src, width)} ${width}w`).join(", ");
}
