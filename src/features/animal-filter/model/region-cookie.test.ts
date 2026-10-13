import { describe, expect, it, vi } from "vitest";
import { formatRegionCookie, parseRegionCookie, REGION_COOKIE, rememberRegion } from "./region-cookie";

const SEOUL = "6110000";
const JONGNO = "3000000";
const BUSAN = "6260000";

describe("parseRegionCookie", () => {
  it("시도만", () => {
    expect(parseRegionCookie(BUSAN)).toEqual({ region: BUSAN });
  });

  it("시도.시군구", () => {
    expect(parseRegionCookie(`${SEOUL}.${JONGNO}`)).toEqual({ region: SEOUL, district: JONGNO });
  });

  it("전국", () => {
    expect(parseRegionCookie("all")).toEqual({});
  });

  it.each(["5280000", "5320000"])("목록에서 뺀 창원시 옛 코드 %s는 5670000으로 읽는다(12절 41)", (code) => {
    expect(parseRegionCookie(`6480000.${code}`)).toEqual({ region: "6480000", district: "5670000" });
  });

  it.each([
    undefined,
    null,
    "",
    "몰라",
    "9999999", // 목록에 없는 시도
    `${SEOUL}.9999999`, // 그 시도에 없는 시군구
    `${SEOUL}.${JONGNO}.x`, // 형식 깨짐
    `${BUSAN}.${JONGNO}`, // 다른 시도의 시군구
    " 6110000",
  ])("잘못된 값 %j는 null(조용히 무시)", (value) => {
    expect(parseRegionCookie(value)).toBeNull();
  });
});

describe("formatRegionCookie", () => {
  it.each([
    [{ region: BUSAN }, BUSAN],
    [{ region: SEOUL, district: JONGNO }, `${SEOUL}.${JONGNO}`],
    [{}, "all"],
  ])("%j → %j", (area, expected) => {
    expect(formatRegionCookie(area)).toBe(expected);
  });

  it("parse ∘ format 왕복", () => {
    for (const area of [{ region: BUSAN }, { region: SEOUL, district: JONGNO }, {}]) {
      expect(parseRegionCookie(formatRegionCookie(area))).toEqual(area);
    }
  });
});

describe("rememberRegion", () => {
  it("path, max-age, SameSite를 붙여 쿠키에 쓴다", () => {
    const written: string[] = [];
    vi.stubGlobal("document", {
      set cookie(value: string) {
        written.push(value);
      },
    });
    try {
      rememberRegion({ region: SEOUL, district: JONGNO });
    } finally {
      vi.unstubAllGlobals();
    }
    expect(written).toEqual([
      `${REGION_COOKIE}=${SEOUL}.${JONGNO}; path=/; max-age=31536000; SameSite=Lax`,
    ]);
  });
});
