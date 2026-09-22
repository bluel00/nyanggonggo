import { describe, expect, it } from "vitest";
import { DEFAULT_ANIMAL_FILTER, isSameFilter, parseAnimalFilter, toFilterHref, toFilterQuery } from "./filter";

const qs = (s: string) => new URLSearchParams(s);

describe("parseAnimalFilter", () => {
  it("값이 없으면 기본값(cat/protected/latest), region 없음", () => {
    expect(parseAnimalFilter(qs(""))).toEqual(DEFAULT_ANIMAL_FILTER);
    expect(parseAnimalFilter({})).toEqual(DEFAULT_ANIMAL_FILTER);
  });

  it("URL 값을 읽는다(URLSearchParams와 Next searchParams 객체 모두)", () => {
    const expected = { species: "dog", region: "6260000", status: "all", sort: "endingSoon" };
    expect(parseAnimalFilter(qs("species=dog&region=6260000&status=all&sort=endingSoon"))).toEqual(expected);
    expect(parseAnimalFilter({ species: "dog", region: ["6260000", "x"], status: "all", sort: "endingSoon" })).toEqual(expected);
  });

  it("잘못된 값은 기본값으로 본다(화면은 깨지지 않는다)", () => {
    expect(parseAnimalFilter(qs("species=bird&status=notice&sort=old&region=부산"))).toEqual(DEFAULT_ANIMAL_FILTER);
  });

  it("page, cursor 등 다른 키는 필터에 들어오지 않는다", () => {
    expect(parseAnimalFilter(qs("page=3&cursor=MjA"))).toEqual(DEFAULT_ANIMAL_FILTER);
  });
});

describe("toFilterQuery / toFilterHref", () => {
  it("기본값은 URL에 넣지 않는다(기본 상태는 경로만)", () => {
    expect(toFilterQuery(DEFAULT_ANIMAL_FILTER)).toBe("");
    expect(toFilterHref("/", DEFAULT_ANIMAL_FILTER)).toBe("/");
  });

  it("기본값과 다른 값만 고정 순서로 넣는다", () => {
    expect(toFilterQuery({ species: "dog", status: "protected", sort: "endingSoon", region: "6110000" })).toBe(
      "species=dog&region=6110000&sort=endingSoon",
    );
  });

  it("필터와 무관한 파라미터는 보존하고, 이전 필터 값과 page/cursor는 지운다", () => {
    const base = qs("utm_source=kakao&species=dog&region=6110000&page=3&cursor=MjA");
    expect(toFilterHref("/", { species: "cat", status: "ended", sort: "latest" }, base)).toBe("/?utm_source=kakao&status=ended");
  });

  it("parse ∘ toFilterQuery 왕복", () => {
    const filter = { species: "dog", region: "6500000", status: "all", sort: "endingSoon" } as const;
    expect(parseAnimalFilter(qs(toFilterQuery(filter)))).toEqual(filter);
  });
});

describe("isSameFilter", () => {
  it("region 없음과 undefined를 같게 본다", () => {
    expect(isSameFilter(DEFAULT_ANIMAL_FILTER, { ...DEFAULT_ANIMAL_FILTER, region: undefined })).toBe(true);
    expect(isSameFilter(DEFAULT_ANIMAL_FILTER, { ...DEFAULT_ANIMAL_FILTER, region: "6110000" })).toBe(false);
  });
});
