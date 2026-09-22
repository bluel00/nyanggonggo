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

/** 카드 img src. 허용되지 않은 원본이면 null(대체 UI) */
export function toImageProxyUrl(src: string): string | null {
  if (!isAllowedImageSource(src)) return null;
  return `${IMAGE_PROXY_PATH}?${new URLSearchParams({ src })}`;
}
