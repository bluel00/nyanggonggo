import { inflateSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { createHttpClient, type FetchLike } from "@/shared/api/http-client";
import { createImageProxy } from "./image-proxy";
import type { ImageResizer } from "./resize-image";

const SRC = "http://openapi.animal.go.kr/openapi/service/rest/fileDownloadSrvc/files/shelter/2026/09/1%5B1%5D.jpg";
/** 실제 JPEG 시그니처(FF D8 FF) */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);

/** 가짜 변환기가 돌려주는 바이트(WebP 시그니처) */
const RESIZED = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

function setup(
  fetchImpl: FetchLike,
  overrides: { maxBytes?: number; timeoutMs?: number; resize?: ImageResizer } = {},
) {
  const fetch = vi.fn(fetchImpl);
  const logger = { warn: vi.fn() };
  const resize = vi.fn<ImageResizer>(overrides.resize ?? (async () => RESIZED.slice()));
  const proxy = createImageProxy({
    http: createHttpClient({ fetch }),
    logger,
    timeoutMs: overrides.timeoutMs ?? 1000,
    maxBytes: overrides.maxBytes ?? 1024,
    cacheControl: "public, max-age=86400",
    fallbackCacheControl: "no-store",
    resize,
  });
  return { fetch, logger, proxy, resize };
}

/** 업스트림은 실제 이미지를 주면서 Content-Type을 application/octet-stream으로 잘못 표기한다(2026-09-27 확인) */
const jpeg = async () => new Response(JPEG, { status: 200, headers: { "content-type": "application/octet-stream" } });

async function expectFallback(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/png");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-image-proxy")).toBe("fallback");
  const bytes = new Uint8Array(await response.arrayBuffer());
  expect([...bytes.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

describe("image proxy", () => {
  it.each([null, "", "http://example.com/a.jpg", "https://openapi.animal.go.kr/a.jpg", "http://openapi.animal.go.kr@evil.com/"])(
    "허용되지 않은 src %j → 400, 원본을 호출하지 않는다",
    async (src) => {
      const { fetch, proxy } = setup(jpeg);
      const response = await proxy(src);
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect((await response.json()).error.code).toBe("invalid_request");
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("업스트림 Content-Type이 octet-stream이어도 바이트로 판별해 image/jpeg로 내려준다", async () => {
    const { fetch, proxy } = setup(jpeg);
    const response = await proxy(SRC);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(JPEG);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(SRC); // 이미 인코딩된 %5B를 다시 인코딩하지 않는다
    expect(init).toMatchObject({ redirect: "error", cache: "no-store" });
  });

  it.each([
    ["404", async () => new Response("not found", { status: 404 })],
    ["500", async () => new Response("boom", { status: 500 })],
    ["네트워크 오류", async () => Promise.reject(new TypeError("fetch failed"))],
    ["이미지 바이트가 아닌 응답(헤더는 image/jpeg)", async () => new Response("<html>", { status: 200, headers: { "content-type": "image/jpeg" } })],
    ["너무 짧아 시그니처를 확인할 수 없음", async () => new Response(new Uint8Array([0xff, 0xd8]), { status: 200 })],
  ] as [string, FetchLike][])("원본 실패(%s) → 투명 PNG 대체 응답(캐시 없음)", async (_label, fetchImpl) => {
    const { logger, proxy } = setup(fetchImpl);
    await expectFallback(await proxy(SRC));
    expect(logger.warn).toHaveBeenCalledWith("image proxy fallback", expect.any(Object));
  });

  it.each([
    ["PNG", PNG, "image/png"],
    ["GIF", GIF, "image/gif"],
    ["WebP", WEBP, "image/webp"],
  ] as [string, BodyInit, string][])("%s 시그니처도 형식을 판별해 내려준다", async (_label, bytes, expected) => {
    const { proxy } = setup(async () => new Response(bytes, { status: 200 }), { maxBytes: 1024 });
    const response = await proxy(SRC);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(expected);
    expect(response.headers.get("x-image-proxy")).toBeNull();
  });

  it("content-type이 없어도 바이트가 이미지면 내려준다", async () => {
    const { proxy } = setup(async () => new Response(JPEG, { status: 200 }));
    expect((await proxy(SRC)).headers.get("content-type")).toBe("image/jpeg");
  });

  it("이미지가 아니면 로그에 업스트림 헤더와 앞부분 바이트를 남긴다(본문은 남기지 않는다)", async () => {
    const { logger, proxy } = setup(async () => new Response("<html>secret</html>", { status: 200, headers: { "content-type": "image/png" } }));
    await proxy(SRC);
    const [, detail] = logger.warn.mock.calls[0];
    expect(detail).toMatchObject({ reason: "not_image", upstreamContentType: "image/png" });
    expect(String(detail.prefix)).toMatch(/^[0-9a-f]{2}( [0-9a-f]{2})*$/);
    expect(JSON.stringify(detail)).not.toContain("secret");
  });

  it("타임아웃 → 대체 응답", async () => {
    const hanging: FetchLike = (_i, init) =>
      new Promise((_r, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
    const { proxy } = setup(hanging, { timeoutMs: 5 });
    await expectFallback(await proxy(SRC));
  });

  it("최대 크기를 넘으면 대체 응답", async () => {
    const { proxy } = setup(jpeg, { maxBytes: 3 });
    await expectFallback(await proxy(SRC));
  });

  it("대체 이미지는 투명 1x1 PNG다", async () => {
    const { proxy } = setup(async () => new Response("x", { status: 500 }));
    const png = Buffer.from(await (await proxy(SRC)).arrayBuffer());
    // IHDR: 폭, 높이, 비트 깊이, 색 형식
    expect(png.readUInt32BE(16)).toBe(1);
    expect(png.readUInt32BE(20)).toBe(1);
    const colorType = png[25];
    const idatLength = png.readUInt32BE(33);
    const pixels = inflateSync(png.subarray(41, 41 + idatLength));
    // 필터 바이트 뒤 픽셀. RGBA(6)면 알파 0, 회색+알파(4)면 알파 0
    const alpha = colorType === 6 ? pixels[4] : colorType === 4 ? pixels[2] : -1;
    expect(alpha).toBe(0);
  });

  it("로그에 원본 URL의 쿼리스트링을 남기지 않는다", async () => {
    const { logger, proxy } = setup(async () => new Response("x", { status: 500 }));
    await proxy(`${SRC}?token=secret-value`);
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("secret-value");
  });

  describe("폭(w): 허용 목록 리사이즈 + WebP", () => {
    /** 변환 결과보다 큰 원본(실제 사진처럼). 앞은 JPEG 시그니처 */
    const BIG_JPEG = new Uint8Array(200);
    BIG_JPEG.set([0xff, 0xd8, 0xff, 0xe0]);
    const bigJpeg = async () => new Response(BIG_JPEG, { headers: { "content-type": "application/octet-stream" } });

    it("w가 없으면 지금처럼 원본이고 변환하지 않는다", async () => {
      const { proxy, resize } = setup(bigJpeg);
      const response = await proxy(SRC, null);
      expect(response.headers.get("content-type")).toBe("image/jpeg");
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(BIG_JPEG);
      expect(resize).not.toHaveBeenCalled();
    });

    it.each([480, 828, 1080])("허용 폭 %i → 그 폭으로 줄인 WebP, 캐시 헤더는 성공 응답 그대로", async (width) => {
      const { proxy, resize } = setup(bigJpeg);
      const response = await proxy(SRC, String(width));
      expect(resize).toHaveBeenCalledWith(BIG_JPEG, width);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/webp");
      expect(response.headers.get("cache-control")).toBe("public, max-age=86400");
      expect(response.headers.get("content-length")).toBe(String(RESIZED.byteLength));
      expect(response.headers.get("x-image-proxy")).toBeNull();
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(RESIZED);
    });

    it.each(["800", "0", "-480", "480.0", "abc", "", "1080 ", "99999999"])(
      "허용 목록 밖의 w %j → 400 no-store, 원본을 받지 않는다",
      async (w) => {
        const { fetch, proxy, resize } = setup(bigJpeg);
        const response = await proxy(SRC, w);
        expect(response.status).toBe(400);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect((await response.json()).error.code).toBe("invalid_request");
        expect(fetch).not.toHaveBeenCalled();
        expect(resize).not.toHaveBeenCalled();
      },
    );

    it("변환이 실패하면 원본을 캐시 없이 내려주고 로그를 남긴다(URL·본문 없음)", async () => {
      const failing: ImageResizer = async () => {
        throw new Error("bad input " + SRC);
      };
      const { proxy, logger } = setup(bigJpeg, { resize: failing });
      const response = await proxy(SRC, "828");
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/jpeg");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-image-proxy")).toBe("original");
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(BIG_JPEG);
      expect(logger.warn).toHaveBeenCalledWith("image proxy resize failed", {
        width: 828,
        imageType: "image/jpeg",
        bytes: BIG_JPEG.byteLength,
        name: "Error",
      });
      expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("openapi.animal.go.kr");
    });

    it("변환 결과가 원본보다 크면 원본을 내려준다", async () => {
      const { proxy } = setup(jpeg, { resize: async () => new Uint8Array(500) });
      const response = await proxy(SRC, "480");
      expect(response.headers.get("content-type")).toBe("image/jpeg");
      expect(response.headers.get("cache-control")).toBe("public, max-age=86400");
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(JPEG);
    });

    it("원본을 못 받으면 w가 있어도 지금처럼 투명 대체 이미지이고 변환하지 않는다", async () => {
      const { proxy, resize } = setup(async () => new Response("nope", { status: 404 }));
      await expectFallback(await proxy(SRC, "828"));
      expect(resize).not.toHaveBeenCalled();
    });
  });
});
