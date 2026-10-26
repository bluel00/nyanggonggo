import { describe, expect, it, vi } from "vitest";
import { createHttpClient, type FetchLike } from "@/shared/api/http-client";
import { readFileSync } from "node:fs";
import { fetchOgImage, loadOgFonts, loadOgLogo, OG_FONT_FILES, OG_LOGO_FILE } from "./og-assets";

const SRC = "http://openapi.animal.go.kr/openapi/files/1%5B1%5D.jpg";

describe("loadOgFonts", () => {
  it("pretendard 패키지의 정적 otf(Regular 400, Bold 700)를 node_modules 경로에서 읽는다", async () => {
    const readFile = vi.fn(async (_path: string) => new Uint8Array([1, 2, 3]));
    const fonts = await loadOgFonts(readFile);
    expect(fonts.map((f) => [f.name, f.weight])).toEqual([
      ["Pretendard", 400],
      ["Pretendard", 700],
    ]);
    expect(fonts[0].data.byteLength).toBe(3);
    const paths = readFile.mock.calls.map(([p]) => p.replaceAll("\\", "/"));
    for (const { path } of OG_FONT_FILES) expect(paths.some((p) => p.endsWith(path))).toBe(true);
    for (const { path } of OG_FONT_FILES) expect(path).toMatch(/^node_modules\/pretendard\/dist\/public\/static\/Pretendard-\w+\.otf$/);
  });

  it("읽기에 실패하면 빈 배열(기본 폰트로 대체)과 경고 로그", async () => {
    const logger = { warn: vi.fn() };
    const fonts = await loadOgFonts(async () => {
      throw new Error("ENOENT");
    }, logger);
    expect(fonts).toEqual([]);
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it("실제 패키지 파일이 있다(설치 확인)", async () => {
    const fonts = await loadOgFonts();
    expect(fonts).toHaveLength(2);
    expect(fonts[1].data.byteLength).toBeGreaterThan(100_000);
  });
});

describe("loadOgLogo", () => {
  it("저장소의 로고 원본(tile SVG)을 읽어 SVG data URL로", async () => {
    const readFile = vi.fn(async (_path: string) => new TextEncoder().encode("<svg/>"));
    const logo = await loadOgLogo(readFile);
    expect(logo).toBe(`data:image/svg+xml;base64,${Buffer.from("<svg/>").toString("base64")}`);
    expect(readFile.mock.calls[0][0].replaceAll("\\", "/").endsWith(OG_LOGO_FILE)).toBe(true);
  });

  it("읽기에 실패하면 null(알약 없이 그린다)과 경고 로그", async () => {
    const logger = { warn: vi.fn() };
    expect(
      await loadOgLogo(async () => {
        throw new Error("ENOENT");
      }, logger),
    ).toBeNull();
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it("실제 파일이 있고 배포 추적(next.config.ts)에 같은 경로가 들어 있다", async () => {
    const logo = await loadOgLogo();
    expect(Buffer.from(logo!.split(",")[1], "base64").toString("utf8")).toContain("<svg");
    expect(readFileSync("next.config.ts", "utf8")).toContain(`"./${OG_LOGO_FILE}"`);
  });
});

describe("fetchOgImage", () => {
  const http = (fetch: FetchLike) => createHttpClient({ fetch });

  it("허용된 원본을 받아 data URL로(프록시 없이 서버가 직접). 업스트림 Content-Type이 틀려도 바이트로 판별한다", async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const fetch = vi.fn<FetchLike>(async () => new Response(jpeg, { headers: { "content-type": "application/octet-stream" } }));
    await expect(fetchOgImage(SRC, http(fetch), { timeoutMs: 1000 })).resolves.toBe("data:image/jpeg;base64,/9j/4A==");
    expect(fetch.mock.calls[0][0]).toBe(SRC);
  });

  it("허용되지 않은 원본이나 null은 받지 않고 null", async () => {
    const fetch = vi.fn<FetchLike>();
    await expect(fetchOgImage("http://example.com/a.jpg", http(fetch), { timeoutMs: 1000 })).resolves.toBeNull();
    await expect(fetchOgImage(null, http(fetch), { timeoutMs: 1000 })).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["404", async () => new Response("x", { status: 404 })],
    ["이미지 바이트가 아님", async () => new Response("<html>", { headers: { "content-type": "image/jpeg" } })],
    ["네트워크 오류", async () => Promise.reject(new TypeError("fetch failed"))],
  ] as [string, FetchLike][])("%s → null(사진 없이 그린다)", async (_label, fetch) => {
    await expect(fetchOgImage(SRC, http(fetch), { timeoutMs: 1000 })).resolves.toBeNull();
  });
});
