import { describe, expect, it } from "vitest";
import type { Animal } from "@/entities/animal";
import { animalListFilter, animalListHref } from "./from-animal";

/** regionText는 업스트림 orgNm 그대로다. 값은 2026-09-29 라이브 실측에서 가져왔다 */
const animal = (overrides: Partial<Animal> = {}): Animal => ({
  id: "411317202600404",
  species: "cat",
  images: [],
  status: "protected",
  noticeEndAt: null,
  sex: "unknown",
  ageText: null,
  regionText: "서울특별시 종로구",
  shelterName: null,
  foundPlaceText: null,
  noticePeriodText: null,
  specialMarkText: null,
  ...overrides,
});

describe("animalListFilter", () => {
  it("시도 + 시군구를 코드로 되찾는다", () => {
    expect(animalListFilter(animal())).toEqual({
      species: "cat",
      region: "6110000",
      district: "3000000",
      status: "protected",
      sort: "latest",
    });
  });

  it("종과 상태는 공고 값을 그대로 쓴다", () => {
    const result = animalListFilter(animal({ species: "dog", status: "ended", regionText: "부산광역시 금정구" }));
    expect(result).toMatchObject({ species: "dog", status: "ended", region: "6260000", district: "3350000" });
  });

  it.each([
    ["경기도 고양시", "6410000", "3940000"],
    ["경상남도 사천시", "6480000", "5340000"],
  ])("%s → 시군구까지", (regionText, region, district) => {
    expect(animalListFilter(animal({ regionText }))).toMatchObject({ region, district });
  });

  it("시 아래 구 형식은 구를 먼저 맞춰 본다", () => {
    // 경기도 목록에는 수원시와 권선구가 따로 있다(업스트림 sigungu_v2 기준)
    expect(animalListFilter(animal({ regionText: "경기도 수원시 권선구" }))).toMatchObject({
      region: "6410000",
      district: "3760000",
    });
  });

  it("구를 못 찾으면 시로 맞춘다", () => {
    expect(animalListFilter(animal({ regionText: "경기도 고양시 덕양구" }))).toMatchObject({
      region: "6410000",
      district: "3940000",
    });
  });

  it("시군구를 못 찾으면 시도만(실측: 창원시는 코드가 셋이라 이름이 안 맞는다)", () => {
    expect(animalListFilter(animal({ regionText: "경상남도 창원시 의창성산구" }))).toEqual({
      species: "cat",
      region: "6480000",
      status: "protected",
      sort: "latest",
    });
  });

  it.each([
    ["세종특별자치시", "5690000"],
    ["제주특별자치도", "6500000"],
  ])("시군구가 없는 %s는 시도만", (regionText, region) => {
    expect(animalListFilter(animal({ regionText }))).toEqual({
      species: "cat",
      region,
      status: "protected",
      sort: "latest",
    });
  });

  it("시도를 못 찾으면 전국", () => {
    expect(animalListFilter(animal({ regionText: "알 수 없는 기관" }))).toEqual({
      species: "cat",
      status: "protected",
      sort: "latest",
    });
  });
});

describe("animalListHref", () => {
  it("기본값은 생략하고 focus를 붙인다", () => {
    expect(animalListHref(animal({ regionText: "서울특별시 종로구" }))).toBe(
      "/?focus=411317202600404&region=6110000&district=3000000",
    );
  });

  it("기본 지역(서울 전체)과 기본값만 남으면 focus만 붙는다", () => {
    expect(animalListHref(animal({ regionText: "서울특별시" }))).toBe("/?focus=411317202600404");
  });

  it("전국이면 region=all", () => {
    expect(animalListHref(animal({ regionText: "알 수 없는 기관", species: "dog", status: "ended" }))).toBe(
      "/?focus=411317202600404&species=dog&region=all&status=ended",
    );
  });
});
