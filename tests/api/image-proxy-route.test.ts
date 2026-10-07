/** /api/image-proxy Route Handler. 전역 fetch를 가짜로 바꿔 네트워크를 쓰지 않는다. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/image-proxy/route";
import sharp from "sharp";
import { toImageProxyUrl } from "@/contract/images";

const SRC = "http://openapi.animal.go.kr/openapi/service/rest/fileDownloadSrvc/files/shelter/2026/09/1%5B1%5D.jpg";
/** 실제 JPEG 시그니처(FF D8 FF). 업스트림은 Content-Type을 octet-stream으로 잘못 준다 */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const upstream = vi.fn(
  async (_input: string | URL | Request) =>
    new Response(JPEG, { headers: { "content-type": "application/octet-stream" } }),
);

beforeEach(() => {
  vi.stubGlobal("fetch", upstream);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  upstream.mockClear();
});

describe("GET /api/image-proxy", () => {
  it("클라이언트가 만든 프록시 URL(toImageProxyUrl)을 그대로 받아 원본을 전달한다", async () => {
    const response = await GET(new Request(`http://localhost${toImageProxyUrl(SRC)}`));
    expect(response.status).toBe(200);
    // 업스트림 헤더(octet-stream)가 아니라 바이트로 판별한 형식을 우리가 설정한다
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toContain("max-age");
    expect(String(upstream.mock.calls[0][0])).toBe(SRC);
  });

  it("w가 있으면 실제 sharp로 줄인 WebP를 내려준다", async () => {
    const photo = await sharp({ create: { width: 1600, height: 2000, channels: 3, background: "#c08040" } }).jpeg().toBuffer();
    upstream.mockImplementationOnce(async () => new Response(new Uint8Array(photo)));
    const response = await GET(new Request("http://localhost" + toImageProxyUrl(SRC, 828)));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toContain("s-maxage");
    const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 828, 1035]);
  });

  it("w가 있어도 변환할 수 없는 바이트면 원본을 그대로 캐시 없이 내려준다", async () => {
    const response = await GET(new Request("http://localhost" + toImageProxyUrl(SRC, 480)));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-image-proxy")).toBe("original");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(JPEG);
  });

  it("허용 목록 밖의 w는 400이다", async () => {
    const response = await GET(new Request("http://localhost" + toImageProxyUrl(SRC) + "&w=800"));
    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("다른 도메인은 400", async () => {
    const response = await GET(new Request("http://localhost/api/image-proxy?src=http%3A%2F%2Fexample.com%2Fa.jpg"));
    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
});
