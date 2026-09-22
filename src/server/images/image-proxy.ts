import { isAllowedImageSource } from "@/contract/images";
import { HttpError, type HttpClient } from "@/shared/api/http-client";
import { noopLogger, type Logger } from "../logger";

/**
 * 이미지 프록시. 공공 API 이미지(http)를 서버에서 받아 같은 origin(https)으로 내려준다.
 *
 * - 원본은 IMAGE_SOURCE_PREFIX로 시작하는 URL만 허용한다. 그 외는 400(오픈 프록시 방지).
 * - 리다이렉트를 따라가지 않는다(허용된 호스트가 다른 호스트로 보내는 경우 차단).
 * - 원본 실패(4xx/5xx, 타임아웃, 네트워크, 이미지가 아닌 응답, 크기 초과)는 502 대신 200 + 투명 1x1 PNG를
 *   캐시 없이 내려준다. 카드의 사진 영역 배경(토큰 색)이 그대로 보여 깨진 이미지 아이콘이 나오지 않는다.
 *   구분은 `X-Image-Proxy: fallback` 헤더와 서버 로그로 한다.
 */

/** 투명 1x1 PNG(RGBA 0,0,0,0, 68바이트). 테스트가 알파 0을 검증한다 */
const TRANSPARENT_PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII="),
  (c) => c.charCodeAt(0),
);

export type ImageProxyOptions = {
  http: HttpClient;
  logger?: Logger;
  timeoutMs: number;
  maxBytes: number;
  cacheControl: string;
  fallbackCacheControl: string;
};

export function createImageProxy(options: ImageProxyOptions) {
  const { http, logger = noopLogger } = options;

  function fallback(reason: string, detail: Record<string, unknown> = {}): Response {
    logger.warn("image proxy fallback", { reason, ...detail });
    return new Response(TRANSPARENT_PNG, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": options.fallbackCacheControl,
        "X-Image-Proxy": "fallback",
      },
    });
  }

  return async function proxyImage(src: string | null): Promise<Response> {
    if (src === null || !isAllowedImageSource(src)) {
      return Response.json(
        { error: { code: "invalid_request", message: "허용되지 않은 이미지 주소예요." } },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    try {
      const { data, contentType } = await http.getBytes(src, {
        timeoutMs: options.timeoutMs,
        redirect: "error",
        // 바이트를 Next 데이터 캐시(항목 2MB 한도)에 넣지 않는다. 캐시는 응답 Cache-Control(CDN)이 맡는다.
        cache: "no-store",
      });
      if (!contentType?.toLowerCase().startsWith("image/")) return fallback("not_image", { contentType });
      if (data.byteLength > options.maxBytes) return fallback("too_large", { bytes: data.byteLength });
      return new Response(data, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(data.byteLength),
          "Cache-Control": options.cacheControl,
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      if (error instanceof HttpError) {
        return fallback(error.kind, { status: error.status, endpoint: error.endpoint });
      }
      return fallback("unexpected", { name: error instanceof Error ? error.name : typeof error });
    }
  };
}
