import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import type { FetchLike } from "@/shared/api/http-client";
import { createImageSizeReader, type ImageSize, type ImageSizeCache } from "./image-size";

const SRC = "http://openapi.animal.go.kr/openapi/service/rest/fileDownloadSrvc/files/shelter/2026/09/1.jpg";

/** 실제 JPEG(헤더 뒤에 픽셀 데이터가 길게 이어지도록 무늬를 넣는다) */
async function jpeg(width: number, height: number, orientation?: number): Promise<Uint8Array> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 7919) % 251;
  let image = sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg({ quality: 95 });
  if (orientation) image = image.withMetadata({ orientation });
  return new Uint8Array(await image.toBuffer());
}

/** 바이트를 chunk 크기로 나눠 흘려보내는 fetch. 몇 조각을 읽었는지 센다 */
function streamingFetch(bytes: Uint8Array, chunk = 4096) {
  const state = { pulled: 0, total: Math.ceil(bytes.byteLength / chunk), cancelled: false };
  const fetchImpl: FetchLike = async () => {
    let offset = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= bytes.byteLength) return controller.close();
        controller.enqueue(bytes.slice(offset, offset + chunk));
        offset += chunk;
        state.pulled++;
      },
      cancel() {
        state.cancelled = true;
      },
    });
    return new Response(body, { status: 200 });
  };
  return { fetchImpl, state };
}

const options = { timeoutMs: 300, maxBytes: 256 * 1024 };

describe("createImageSizeReader(상세 첫 사진 크기, PRD v1.3)", () => {
  it("스트림 앞부분에서 크기를 읽고 나머지는 받지 않는다(이미지 서버가 Range를 무시)", async () => {
    const bytes = await jpeg(1200, 900);
    const { fetchImpl, state } = streamingFetch(bytes);
    const read = createImageSizeReader({ ...options, fetch: fetchImpl });
    expect(await read(SRC)).toEqual({ width: 1200, height: 900 });
    expect(state.total).toBeGreaterThan(10);
    expect(state.pulled).toBeLessThan(state.total);
    expect(state.cancelled).toBe(true);
  });

  it("EXIF 방향이 90° 회전(6)이면 가로·세로를 바꾼다(프록시·브라우저가 돌려서 보인다)", async () => {
    const { fetchImpl } = streamingFetch(await jpeg(400, 300, 6));
    expect(await createImageSizeReader({ ...options, fetch: fetchImpl })(SRC)).toEqual({ width: 300, height: 400 });
  });

  it.each([
    "https://openapi.animal.go.kr/a.jpg",
    "http://example.com/a.jpg",
    "http://openapi.animal.go.kr.evil.com/a.jpg",
    "http://user@openapi.animal.go.kr/a.jpg",
  ])("허용되지 않은 호스트는 읽지 않는다: %s", async (src) => {
    const fetchImpl = vi.fn<FetchLike>();
    expect(await createImageSizeReader({ ...options, fetch: fetchImpl })(src)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("시간 초과면 null이고 받던 요청을 끊는다", async () => {
    let aborted = false;
    const fetchImpl: FetchLike = (_url, init) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          aborted = true;
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    const started = Date.now();
    expect(await createImageSizeReader({ ...options, timeoutMs: 50, fetch: fetchImpl })(SRC)).toBeNull();
    expect(Date.now() - started).toBeLessThan(250);
    expect(aborted).toBe(true);
  });

  it("캐시 조회가 늦어도 시간 초과 안에 null로 끝낸다", async () => {
    const slowCache: ImageSizeCache = () => new Promise(() => {});
    const read = createImageSizeReader({ ...options, timeoutMs: 50, fetch: vi.fn<FetchLike>(), cache: slowCache });
    expect(await read(SRC)).toBeNull();
  });

  it("오류 응답, 이미지가 아닌 바이트, 네트워크 오류면 null", async () => {
    const notFound: FetchLike = async () => new Response("no", { status: 404 });
    const html: FetchLike = async () => new Response("<html>" + "x".repeat(300 * 1024), { status: 200 });
    const broken: FetchLike = async () => {
      throw new TypeError("fetch failed");
    };
    for (const fetchImpl of [notFound, html, broken]) {
      expect(await createImageSizeReader({ ...options, fetch: fetchImpl })(SRC)).toBeNull();
    }
  });

  it("리다이렉트를 따라가지 않고 캐시하지 않는 요청으로 받는다", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => new Response("no", { status: 500 }));
    await createImageSizeReader({ ...options, fetch: fetchImpl })(SRC);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: "error", cache: "no-store" });
  });

  it("성공한 결과만 캐시한다(실패는 다음 요청에서 다시 읽는다)", async () => {
    // unstable_cache처럼: load가 성공하면 저장하고, 예외는 저장하지 않고 그대로 던진다
    const store = new Map<string, ImageSize>();
    const cache: ImageSizeCache = async (key, load) => {
      const hit = store.get(key);
      if (hit) return hit;
      const value = await load();
      store.set(key, value);
      return value;
    };
    let fail = true;
    const bytes = await jpeg(300, 400);
    const fetchImpl = vi.fn<FetchLike>(async () => (fail ? new Response("no", { status: 503 }) : streamingFetch(bytes).fetchImpl(SRC)));
    const read = createImageSizeReader({ ...options, fetch: fetchImpl, cache });

    expect(await read(SRC)).toBeNull();
    expect(store.size).toBe(0);
    fail = false;
    expect(await read(SRC)).toEqual({ width: 300, height: 400 });
    expect(await read(SRC)).toEqual({ width: 300, height: 400 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("실패 로그에 URL을 넣지 않는다(이유만)", async () => {
    const warn = vi.fn();
    const fetchImpl: FetchLike = async () => new Response("no", { status: 404 });
    await createImageSizeReader({ ...options, fetch: fetchImpl, logger: { warn } })(SRC);
    expect(warn).toHaveBeenCalledWith("image size unavailable", { reason: "status" });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("openapi");
  });
});
