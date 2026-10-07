import { isAllowedImageSource, isImageProxyWidth, type ImageProxyWidth } from "@/contract/images";
import { HttpError, type HttpClient } from "@/shared/api/http-client";
import { noopLogger, type Logger } from "../logger";
import { bytesPrefixHex, detectImageType } from "./image-type";
import type { ImageResizer } from "./resize-image";

/**
 * 이미지 프록시. 공공 API 이미지(http)를 서버에서 받아 같은 origin(https)으로 내려준다.
 *
 * - 원본은 IMAGE_SOURCE_PREFIX로 시작하는 URL만 허용한다. 그 외는 400(오픈 프록시 방지).
 * - 리다이렉트를 따라가지 않는다(허용된 호스트가 다른 호스트로 보내는 경우 차단).
 * - 이미지 여부는 응답 바이트의 매직 넘버로 판별하고 Content-Type도 그 값으로 직접 설정한다. 업스트림 헤더는 믿지 않는다
 *   (fileDownloadSrvc가 실제 이미지를 application/octet-stream으로 표기한다, architecture.md 12절).
 * - 원본 실패(4xx/5xx, 타임아웃, 네트워크, 이미지 바이트가 아님, 크기 초과)는 502 대신 200 + 투명 1x1 PNG를
 *   캐시 없이 내려준다. 카드의 사진 영역 배경(토큰 색)이 그대로 보여 깨진 이미지 아이콘이 나오지 않는다.
 *   구분은 `X-Image-Proxy: fallback` 헤더와 서버 로그로 한다.
 * - `w`(허용 폭, IMAGE_PROXY_WIDTHS)가 있으면 그 폭으로 줄인 WebP를 내려준다(비율 유지, 원본보다 키우지 않음).
 *   목록 밖의 `w`는 400이다. `w`가 없으면 원본 그대로다(풀스크린 뷰어, 공유 이미지).
 *   변환이 실패하면 원본을 그대로 내려주고 로그를 남긴다(사진이 안 보이는 일은 없게). 이때는 캐시하지 않아
 *   다음 요청에서 다시 변환을 시도한다(`X-Image-Proxy: original`). 변환 결과가 원본보다 크면 원본을 내려준다.
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
  /** `w`가 있을 때 쓰는 변환기(서버는 sharp, 테스트는 가짜) */
  resize: ImageResizer;
};

type WidthParam = { ok: true; width: ImageProxyWidth | undefined } | { ok: false };

/** `w` 쿼리: 없으면 원본, 허용 목록의 정수면 그 폭, 그 밖은 거부 */
function parseWidth(value: string | null): WidthParam {
  if (value === null) return { ok: true, width: undefined };
  if (!/^\d{1,5}$/.test(value)) return { ok: false };
  const width = Number(value);
  return isImageProxyWidth(width) ? { ok: true, width } : { ok: false };
}

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

  function image(data: Uint8Array<ArrayBuffer> | ArrayBuffer, contentType: string, cacheControl: string, extra: Record<string, string> = {}) {
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(data.byteLength),
        "Cache-Control": cacheControl,
        "X-Content-Type-Options": "nosniff",
        ...extra,
      },
    });
  }

  return async function proxyImage(src: string | null, widthParam: string | null = null): Promise<Response> {
    if (src === null || !isAllowedImageSource(src)) {
      return Response.json(
        { error: { code: "invalid_request", message: "허용되지 않은 이미지 주소예요." } },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const width = parseWidth(widthParam);
    if (!width.ok) {
      return Response.json(
        { error: { code: "invalid_request", message: "허용되지 않은 이미지 크기예요." } },
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
      const imageType = detectImageType(data);
      if (imageType === null) {
        return fallback("not_image", { upstreamContentType: contentType, bytes: data.byteLength, prefix: bytesPrefixHex(data) });
      }
      if (data.byteLength > options.maxBytes) return fallback("too_large", { bytes: data.byteLength });
      if (width.width === undefined) return image(data, imageType, options.cacheControl);

      let resized: Uint8Array<ArrayBuffer>;
      try {
        resized = await options.resize(new Uint8Array(data), width.width);
      } catch (error) {
        logger.warn("image proxy resize failed", {
          width: width.width,
          imageType,
          bytes: data.byteLength,
          name: error instanceof Error ? error.name : typeof error,
        });
        return image(data, imageType, options.fallbackCacheControl, { "X-Image-Proxy": "original" });
      }
      // 이미 작은 원본(작은 폭, 높은 압축)은 WebP가 더 클 수 있다. 그때는 원본이 낫다
      if (resized.byteLength >= data.byteLength) return image(data, imageType, options.cacheControl);
      return image(resized, "image/webp", options.cacheControl);
    } catch (error) {
      if (error instanceof HttpError) {
        return fallback(error.kind, { status: error.status, endpoint: error.endpoint });
      }
      return fallback("unexpected", { name: error instanceof Error ? error.name : typeof error });
    }
  };
}
