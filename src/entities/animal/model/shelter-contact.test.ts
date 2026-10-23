import { describe, expect, it } from "vitest";
import { mapSearchUrl, telHref } from "./shelter-contact";

// 주소는 지어낸 값이다. 어떤 줄에 링크를 붙이는지는 ui/detail-rows.test.ts가 본다
const ADDRESS = "가상특별시 예시구 테스트로 12 (샘플동)";
describe("telHref", () => {
  it.each([
    ["000-1234-5678", "tel:00012345678"],
    ["(000) 123 4567", "tel:0001234567"],
    [" 0000-0000 ", "tel:00000000"],
    ["000.111.2222", "tel:0001112222"],
  ])("%s → 숫자만 남긴다", (input, expected) => {
    expect(telHref(input)).toBe(expected);
  });

  it("숫자가 없으면 null", () => {
    expect(telHref("--")).toBeNull();
  });
});

describe("mapSearchUrl", () => {
  it("카카오맵 검색결과 바로가기 경로에 주소를 인코딩해 붙인다", () => {
    const url = mapSearchUrl(ADDRESS);
    expect(url.startsWith("https://map.kakao.com/link/search/")).toBe(true);
    expect(decodeURIComponent(url.slice("https://map.kakao.com/link/search/".length))).toBe(ADDRESS);
    expect(url).not.toMatch(/[\s가-힣]/);
  });

  it("/ ? # & 도 인코딩해 경로가 끊기지 않는다", () => {
    expect(mapSearchUrl("가상로 1/2 ?#&")).toBe(
      "https://map.kakao.com/link/search/%EA%B0%80%EC%83%81%EB%A1%9C%201%2F2%20%3F%23%26",
    );
  });
});
