import { describe, expect, it } from "vitest";
import {
  DEFAULT_ANIMAL_FILTER,
  DEFAULT_DISTRICT,
  DEFAULT_REGION,
  isSameFilter,
  parseAnimalFilter,
  toFilterHref,
  toFilterQuery,
} from "./filter";

const qs = (s: string) => new URLSearchParams(s);
const SEOUL = "6110000";
const JONGNO = "3000000";
const GANGNAM = "3220000";
const BUSAN = "6260000";
const BUSAN_JUNG = "3250000";

describe("기본값", () => {
  it("서울/종로구(정적 목록에 있는 코드)", () => {
    expect(DEFAULT_REGION).toBe(SEOUL);
    expect(DEFAULT_DISTRICT).toBe(JONGNO);
  });
});

describe("parseAnimalFilter", () => {
  it("값이 없으면 기본값(cat/서울/종로구/protected/latest)", () => {
    expect(parseAnimalFilter(qs(""))).toEqual(DEFAULT_ANIMAL_FILTER);
    expect(parseAnimalFilter({})).toEqual(DEFAULT_ANIMAL_FILTER);
  });

  it("region=all은 전국(region, district 없음)", () => {
    expect(parseAnimalFilter(qs("region=all"))).toEqual({ species: "cat", status: "protected", sort: "latest" });
    expect(parseAnimalFilter(qs(`region=all&district=${JONGNO}`))).not.toHaveProperty("district");
  });

  it("region만 있으면 그 시도 전체(기본 시군구를 붙이지 않는다)", () => {
    expect(parseAnimalFilter(qs(`region=${SEOUL}`))).toEqual({ ...DEFAULT_ANIMAL_FILTER, district: undefined, region: SEOUL });
    expect(parseAnimalFilter(qs(`region=${SEOUL}`))).not.toHaveProperty("district");
  });

  it("region + 그 시도의 district", () => {
    expect(parseAnimalFilter(qs(`region=${BUSAN}&district=${BUSAN_JUNG}`))).toMatchObject({ region: BUSAN, district: BUSAN_JUNG });
  });

  it("다른 시도의 district나 목록에 없는 district는 버리고 시도 전체", () => {
    const parsed = parseAnimalFilter(qs(`region=${BUSAN}&district=${JONGNO}`));
    expect(parsed.region).toBe(BUSAN);
    expect(parsed).not.toHaveProperty("district");
  });

  it("목록에 없는 region(옛 코드 등)이나 district만 있으면 기본 지역", () => {
    expect(parseAnimalFilter(qs("region=6290000"))).toMatchObject({ region: SEOUL, district: JONGNO });
    expect(parseAnimalFilter(qs(`district=${GANGNAM}`))).toMatchObject({ region: SEOUL, district: JONGNO });
  });

  it("URL 값을 읽는다(Next searchParams 객체, 배열이면 첫 값)", () => {
    expect(
      parseAnimalFilter({ species: "dog", region: [SEOUL, "x"], district: GANGNAM, status: "all", sort: "endingSoon" }),
    ).toEqual({ species: "dog", region: SEOUL, district: GANGNAM, status: "all", sort: "endingSoon" });
  });

  it("잘못된 species/status/sort는 기본값", () => {
    expect(parseAnimalFilter(qs("species=bird&status=notice&sort=old"))).toEqual(DEFAULT_ANIMAL_FILTER);
  });
});

describe("toFilterQuery / toFilterHref", () => {
  it("기본값은 URL에 넣지 않는다(기본 상태는 경로만)", () => {
    expect(toFilterQuery(DEFAULT_ANIMAL_FILTER)).toBe("");
    expect(toFilterHref("/", DEFAULT_ANIMAL_FILTER)).toBe("/");
  });

  it("전국은 region=all로 남긴다(생략하면 기본 지역이 되므로)", () => {
    expect(toFilterQuery({ species: "cat", status: "protected", sort: "latest" })).toBe("region=all");
  });

  it("서울 전체는 region만, 다른 시군구는 region+district", () => {
    expect(toFilterQuery({ ...DEFAULT_ANIMAL_FILTER, district: undefined })).toBe(`region=${SEOUL}`);
    expect(toFilterQuery({ ...DEFAULT_ANIMAL_FILTER, district: GANGNAM })).toBe(`region=${SEOUL}&district=${GANGNAM}`);
  });

  it("필터와 무관한 파라미터는 보존하고, 이전 필터 값과 page/cursor는 지운다", () => {
    const base = qs(`utm_source=kakao&species=dog&region=${BUSAN}&district=${BUSAN_JUNG}&page=3&cursor=MjA`);
    expect(toFilterHref("/", { ...DEFAULT_ANIMAL_FILTER, status: "ended" }, base)).toBe("/?utm_source=kakao&status=ended");
  });

  it.each([
    DEFAULT_ANIMAL_FILTER,
    { species: "dog", status: "all", sort: "endingSoon" },
    { species: "cat", region: BUSAN, status: "protected", sort: "latest" },
    { species: "cat", region: BUSAN, district: BUSAN_JUNG, status: "ended", sort: "latest" },
  ] as const)("parse ∘ toFilterQuery 왕복 %#", (filter) => {
    expect(isSameFilter(parseAnimalFilter(qs(toFilterQuery(filter))), filter)).toBe(true);
  });
});

describe("isSameFilter", () => {
  it("region/district 없음과 undefined를 같게 본다", () => {
    const nationwide = { species: "cat", status: "protected", sort: "latest" } as const;
    expect(isSameFilter(nationwide, { ...nationwide, region: undefined, district: undefined })).toBe(true);
    expect(isSameFilter(DEFAULT_ANIMAL_FILTER, { ...DEFAULT_ANIMAL_FILTER, district: undefined })).toBe(false);
  });
});
