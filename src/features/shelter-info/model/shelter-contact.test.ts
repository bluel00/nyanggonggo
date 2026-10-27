import { describe, expect, it } from "vitest";
import { mapSearchUrl, shelterContactRows, telHref } from "./shelter-contact";
import { makeAnimal } from "@tests/factories/animal";

// 주소·전화는 지어낸 값이다
const ADDRESS = "가상특별시 예시구 테스트로 12 (샘플동)";
const TEL = "000-1234-5678";
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

describe("shelterContactRows: 보호소 정보 시트의 줄(#62)", () => {
  it("주소(+ 지도, 새 탭 링크) → 전화(+ tel: 숫자만)", () => {
    expect(shelterContactRows(makeAnimal({ shelterAddressText: ADDRESS, shelterTelText: TEL }))).toEqual([
      { label: "주소", value: ADDRESS, link: { action: "map", href: mapSearchUrl(ADDRESS) } },
      { label: "전화", value: TEL, link: { action: "call", href: "tel:00012345678" } },
    ]);
  });

  it("값이 없는 줄은 뺀다", () => {
    expect(shelterContactRows(makeAnimal({ shelterAddressText: ADDRESS })).map((row) => row.label)).toEqual(["주소"]);
    expect(shelterContactRows(makeAnimal({ shelterTelText: TEL })).map((row) => row.label)).toEqual(["전화"]);
    expect(shelterContactRows(makeAnimal())).toEqual([]);
  });

  it("전화에 숫자가 없으면 줄은 두고 링크만 뺀다", () => {
    expect(shelterContactRows(makeAnimal({ shelterTelText: "문의 바람" }))).toEqual([{ label: "전화", value: "문의 바람", link: null }]);
  });

  it("종료 공고는 줄을 내지 않는다", () => {
    expect(shelterContactRows(makeAnimal({ status: "ended", shelterAddressText: ADDRESS, shelterTelText: TEL }))).toEqual([]);
  });
});
