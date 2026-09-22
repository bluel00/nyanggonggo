/** /api/image-proxy Route Handler. 전역 fetch를 가짜로 바꿔 네트워크를 쓰지 않는다. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/image-proxy/route";
import { toImageProxyUrl } from "@/contract/images";

const SRC = "http://openapi.animal.go.kr/openapi/service/rest/fileDownloadSrvc/files/shelter/2026/09/1%5B1%5D.jpg";
const upstream = vi.fn(
  async (_input: string | URL | Request) =>
    new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } }),
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
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toContain("max-age");
    expect(String(upstream.mock.calls[0][0])).toBe(SRC);
  });

  it("다른 도메인은 400", async () => {
    const response = await GET(new Request("http://localhost/api/image-proxy?src=http%3A%2F%2Fexample.com%2Fa.jpg"));
    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
});
