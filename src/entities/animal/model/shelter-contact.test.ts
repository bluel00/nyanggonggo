import { describe, expect, it } from "vitest";
import { getShelterContact, kakaoMapSearchUrl, telHref } from "./shelter-contact";

// 주소·전화는 지어낸 값이다
const ADDRESS = "가상특별시 예시구 테스트로 12 (샘플동)";
const TEL = "000-1234-5678";
const animal = (overrides: Partial<Parameters<typeof getShelterContact>[0]> = {}) => ({
  status: "protected" as const,
  shelterAddressText: ADDRESS,
  shelterTelText: TEL,
  ...overrides,
});

describe("getShelterContact", () => {
  it("보호 중: 주소와 전화가 원문 그대로이고 링크가 있다", () => {
    expect(getShelterContact(animal())).toEqual({
      address: { text: ADDRESS, mapUrl: kakaoMapSearchUrl(ADDRESS) },
      tel: { text: TEL, href: "tel:00012345678" },
    });
  });

  it("종료: 주소와 전화를 숨긴다", () => {
    expect(getShelterContact(animal({ status: "ended" }))).toEqual({ address: null, tel: null });
  });

  it("주소 없음: 주소 줄만 뺀다", () => {
    const contact = getShelterContact(animal({ shelterAddressText: null }));
    expect(contact.address).toBeNull();
    expect(contact.tel?.text).toBe(TEL);
  });

  it("전화 없음: 전화 줄만 뺀다", () => {
    const contact = getShelterContact(animal({ shelterTelText: null }));
    expect(contact.tel).toBeNull();
    expect(contact.address?.text).toBe(ADDRESS);
  });

  it("전화에 숫자가 없으면 줄은 두고 링크만 뺀다", () => {
    expect(getShelterContact(animal({ shelterTelText: "미정" })).tel).toEqual({ text: "미정", href: null });
  });
});

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

describe("kakaoMapSearchUrl", () => {
  it("카카오맵 검색결과 바로가기 경로에 주소를 인코딩해 붙인다", () => {
    const url = kakaoMapSearchUrl(ADDRESS);
    expect(url.startsWith("https://map.kakao.com/link/search/")).toBe(true);
    expect(decodeURIComponent(url.slice("https://map.kakao.com/link/search/".length))).toBe(ADDRESS);
    expect(url).not.toMatch(/[\s가-힣]/);
  });

  it("/ ? # & 도 인코딩해 경로가 끊기지 않는다", () => {
    expect(kakaoMapSearchUrl("가상로 1/2 ?#&")).toBe(
      "https://map.kakao.com/link/search/%EA%B0%80%EC%83%81%EB%A1%9C%201%2F2%20%3F%23%26",
    );
  });
});
