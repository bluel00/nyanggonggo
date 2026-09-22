import { inflateSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { createHttpClient, type FetchLike } from "@/shared/api/http-client";
import { createImageProxy } from "./image-proxy";

const SRC = "http://openapi.animal.go.kr/openapi/service/rest/fileDownloadSrvc/files/shelter/2026/09/1%5B1%5D.jpg";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

function setup(fetchImpl: FetchLike, overrides: { maxBytes?: number; timeoutMs?: number } = {}) {
  const fetch = vi.fn(fetchImpl);
  const logger = { warn: vi.fn() };
  const proxy = createImageProxy({
    http: createHttpClient({ fetch }),
    logger,
    timeoutMs: overrides.timeoutMs ?? 1000,
    maxBytes: overrides.maxBytes ?? 1024,
    cacheControl: "public, max-age=86400",
    fallbackCacheControl: "no-store",
  });
  return { fetch, logger, proxy };
}

const jpeg = async () => new Response(JPEG, { status: 200, headers: { "content-type": "image/jpeg" } });

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

  it("정상 응답은 content-type과 바이트를 그대로, Cache-Control을 붙여 내려준다", async () => {
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
    ["이미지가 아닌 응답", async () => new Response("<html>", { status: 200, headers: { "content-type": "text/html" } })],
    ["content-type 없음", async () => new Response(JPEG, { status: 200 })],
  ] as [string, FetchLike][])("원본 실패(%s) → 투명 PNG 대체 응답(캐시 없음)", async (_label, fetchImpl) => {
    const { logger, proxy } = setup(fetchImpl);
    await expectFallback(await proxy(SRC));
    expect(logger.warn).toHaveBeenCalledWith("image proxy fallback", expect.any(Object));
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
});
