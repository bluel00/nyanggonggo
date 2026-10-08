import sharp from "sharp";
import { isAllowedImageSource } from "@/contract/images";
import type { FetchLike } from "@/shared/api/http-client";
import { noopLogger, type Logger } from "../logger";

/**
 * 공고 사진의 가로·세로(px)를 서버에서 미리 읽는다. 상세 화면의 사진 칸 비율을 첫 사진에 맞추려고 쓴다(PRD v1.3, architecture.md 12절 50).
 *
 * - 이미지 프록시와 같은 허용 호스트 검사(`isAllowedImageSource`)를 거친다. 허용되지 않은 URL은 받지 않고 null.
 * - 원본 이미지 서버는 Range 요청을 무시하고 파일 전체를 보낸다. 그래서 스트림으로 받다가 sharp가 헤더에서 크기를 읽는
 *   순간 끊는다(2026-10-08 실측: 사진당 약 10~17KB, 원본은 수백 KB).
 * - 시간 초과(timeoutMs, 300ms)나 실패면 null. 화면은 1:1 칸으로 그린다.
 * - cache가 있으면 URL별로 캐시한다. 성공한 결과만 남도록 실패는 예외로 cache 밖에 알린다(`unstable_cache`는 예외를 저장하지 않는다).
 * - 로그에 URL을 넣지 않는다(이유만).
 */
export type ImageSize = { width: number; height: number };

/** 받은 앞부분 바이트에서 크기를 읽는다. 아직 모자라면 null */
export type ImageSizeProbe = (head: Uint8Array) => Promise<ImageSize | null>;

/** URL별 캐시. load가 성공한 값만 저장하고, load의 예외는 그대로 던진다 */
export type ImageSizeCache = (key: string, load: () => Promise<ImageSize>) => Promise<ImageSize>;

export type ImageSizeReader = (src: string) => Promise<ImageSize | null>;

export type ImageSizeReaderOptions = {
  fetch?: FetchLike;
  timeoutMs: number;
  /** 이만큼 받아도 크기를 못 읽으면 포기한다 */
  maxBytes: number;
  probe?: ImageSizeProbe;
  cache?: ImageSizeCache;
  logger?: Logger;
};

/** 크기 읽기를 시도하는 간격(받은 바이트). 헤더는 대개 첫 수 KB 안에 있다 */
const PROBE_STEP_BYTES = 8 * 1024;

/**
 * sharp 구현. EXIF 방향이 5~8(90° 회전)이면 가로·세로를 바꾼다. 이미지 프록시가 `.rotate()`로 방향을 적용해 내려주고
 * 브라우저도 원본의 EXIF 방향을 적용하므로, 화면에 보이는 비율과 맞춘다.
 */
export const sharpImageSizeProbe: ImageSizeProbe = async (head) => {
  try {
    const meta = await sharp(head, { failOn: "none" }).metadata();
    if (!meta.width || !meta.height) return null;
    const rotated = meta.orientation !== undefined && meta.orientation >= 5 && meta.orientation <= 8;
    return rotated ? { width: meta.height, height: meta.width } : { width: meta.width, height: meta.height };
  } catch {
    return null;
  }
};

type FailureReason = "timeout" | "status" | "network" | "no_header";

class ImageSizeUnavailable extends Error {
  constructor(readonly reason: FailureReason) {
    super(`image size unavailable: ${reason}`);
    this.name = "ImageSizeUnavailable";
  }
}

export function createImageSizeReader(options: ImageSizeReaderOptions): ImageSizeReader {
  const { timeoutMs, maxBytes, cache, logger = noopLogger } = options;
  const fetchImpl = options.fetch ?? fetch;
  const probe = options.probe ?? sharpImageSizeProbe;

  async function read(src: string, signal: AbortSignal): Promise<ImageSize> {
    let response: Response;
    try {
      // 리다이렉트는 따라가지 않는다(허용 호스트가 다른 호스트로 보내는 경우 차단, 이미지 프록시와 같다)
      response = await fetchImpl(src, { signal, redirect: "error", cache: "no-store" });
    } catch {
      throw new ImageSizeUnavailable(signal.aborted ? "timeout" : "network");
    }
    if (!response.ok || !response.body) throw new ImageSizeUnavailable("status");

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    let probedAt = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (value) {
          chunks.push(value);
          received += value.byteLength;
        }
        if (done || received - probedAt >= PROBE_STEP_BYTES || received >= maxBytes) {
          probedAt = received;
          const size = await probe(concat(chunks, received));
          if (size) return size;
        }
        if (done || received >= maxBytes) throw new ImageSizeUnavailable("no_header");
      }
    } catch (error) {
      if (error instanceof ImageSizeUnavailable) throw error;
      throw new ImageSizeUnavailable(signal.aborted ? "timeout" : "network");
    } finally {
      // 나머지는 받지 않는다
      reader.cancel().catch(() => {});
    }
  }

  return async function readImageSize(src) {
    if (!isAllowedImageSource(src)) return null;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // 캐시 조회까지 포함해 timeoutMs 안에 끝낸다. 넘으면 받던 것도 끊는다
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new ImageSizeUnavailable("timeout"));
      }, timeoutMs);
    });
    const load = () => read(src, controller.signal);
    try {
      return await Promise.race([cache ? cache(src, load) : load(), timeout]);
    } catch (error) {
      logger.warn("image size unavailable", { reason: error instanceof ImageSizeUnavailable ? error.reason : "unexpected" });
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
}

function concat(chunks: Uint8Array[], length: number): Uint8Array {
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
