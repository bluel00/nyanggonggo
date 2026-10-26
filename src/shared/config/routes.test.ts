import { describe, expect, it } from "vitest";
import { routes } from "./routes";

describe("routes: 페이지 경로", () => {
  it("진입 경로는 쿼리 없는 /", () => {
    expect(routes.entry()).toBe("/");
  });

  it("목록은 / + 이미 직렬화된 쿼리를 그대로 붙인다(문자열, URLSearchParams)", () => {
    expect(routes.list("species=cat&region=6110000")).toBe("/?species=cat&region=6110000");
    expect(routes.list(new URLSearchParams({ species: "dog", region: "all" }))).toBe("/?species=dog&region=all");
    expect(routes.list("")).toBe("/");
  });

  it("홈은 /home, 쿼리가 있으면 붙인다", () => {
    expect(routes.home()).toBe("/home");
    expect(routes.home("region=6110000")).toBe("/home?region=6110000");
    expect(routes.home(new URLSearchParams())).toBe("/home");
  });

  it("관심 목록, 상세, OG 이미지", () => {
    expect(routes.favorites()).toBe("/favorites");
    expect(routes.detail("990000000000001")).toBe("/animals/990000000000001");
    expect(routes.ogImage()).toBe("/opengraph-image");
    expect(routes.detailOgImage("990000000000001")).toBe("/animals/990000000000001/opengraph-image");
  });

  it("쿼리를 직렬화하지 않는다(받은 값을 바꾸지 않는다)", () => {
    expect(routes.list("b=2&a=1")).toBe("/?b=2&a=1");
  });
});
