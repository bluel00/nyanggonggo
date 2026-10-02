import { describe, expect, it } from "vitest";
import { homeHref, resolveAnimalListEntry, resolveHomeArea, type RememberedFilterCookies } from "./entry";

const SEOUL = "6110000";
const JONGNO = "3000000";
const BUSAN = "6260000";
const BUSAN_JUNG = "3380000";
const ID = "411317202600404";

const qs = (query: string) => new URLSearchParams(query);

/** 리다이렉트면 주소, 그리면 "render" + 필터를 돌려준다 */
function entry(query: string, cookies: RememberedFilterCookies = {}) {
  const result = resolveAnimalListEntry(qs(query), cookies);
  return result.kind === "redirect" ? result.href : result;
}

describe("resolveAnimalListEntry: 축종을 먼저 판정한다(결정 B)", () => {
  it.each([
    // [설명, 쿼리, 쿠키, 기대 주소]
    ["아무것도 없으면 홈으로(기본 축종으로 밀어 넣지 않는다)", "", {}, "/home"],
    ["모르는 축종 값은 없는 것으로 보고 홈으로(값은 버린다)", "species=panda", {}, "/home"],
    ["축종 쿠키가 있으면 축종과 지역을 한 번에 채운다", "", { species: "dog" }, `/?species=dog&region=${SEOUL}`],
    [
      "모르는 축종 값도 쿠키로 바로잡는다",
      "species=panda",
      { species: "other" },
      `/?species=other&region=${SEOUL}`,
    ],
    [
      "축종·지역 쿠키가 둘 다 있으면 둘 다 한 번에 채운다",
      "",
      { species: "dog", region: `${BUSAN}.${BUSAN_JUNG}` },
      `/?species=dog&region=${BUSAN}&district=${BUSAN_JUNG}`,
    ],
    ["URL 축종은 있고 지역이 없으면 지역만 채운다", "species=other", {}, `/?species=other&region=${SEOUL}`],
    [
      "URL 축종이 쿠키보다 우선이다",
      "species=cat",
      { species: "dog" },
      `/?species=cat&region=${SEOUL}`,
    ],
    [
      "모르는 지역 코드도 주소를 바로잡는다",
      `species=cat&region=9999999`,
      { region: BUSAN },
      `/?species=cat&region=${BUSAN}`,
    ],
    ["홈으로 갈 때 지역은 판정하지 않는다(쓸 수 없는 코드도 그대로 옮긴다)", "region=9999999", {}, "/home?region=9999999"],
  ])("%s", (_name, query, cookies, expected) => {
    expect(entry(query, cookies)).toBe(expected);
  });

  it("축종과 지역이 다 있으면 리다이렉트 없이 그린다", () => {
    expect(entry(`species=dog&region=${BUSAN}&status=ended&sort=endingSoon`, { species: "cat", region: SEOUL })).toEqual({
      kind: "render",
      filter: { species: "dog", region: BUSAN, status: "ended", sort: "endingSoon" },
      focusId: null,
    });
  });

  it("sort도 URL 값을 그대로 쓴다", () => {
    const result = resolveAnimalListEntry(qs(`species=cat&region=all&sort=endingSoon`));
    expect(result).toEqual({
      kind: "render",
      filter: { species: "cat", status: "protected", sort: "endingSoon" },
      focusId: null,
    });
  });

  it("focus는 필터가 아니라 focusId로 넘긴다", () => {
    expect(entry(`species=cat&region=${SEOUL}&focus=${ID}`)).toEqual({
      kind: "render",
      filter: { species: "cat", region: SEOUL, status: "protected", sort: "latest" },
      focusId: ID,
    });
  });
});

describe("resolveAnimalListEntry: 다른 파라미터 처리", () => {
  it("홈으로 갈 때도 focus와 utm_*을 옮긴다", () => {
    expect(entry(`focus=${ID}&utm_source=kakao`)).toBe(`/home?focus=${ID}&utm_source=kakao`);
  });

  it("목록으로 채워 보낼 때도 focus와 utm_*을 옮긴다", () => {
    expect(entry(`focus=${ID}&utm_source=kakao`, { species: "dog" })).toBe(
      `/?focus=${ID}&utm_source=kakao&species=dog&region=${SEOUL}`,
    );
  });

  it("page와 cursor는 어느 쪽으로 가든 버린다", () => {
    expect(entry("page=3&cursor=MjA")).toBe("/home");
    expect(entry("page=3&cursor=MjA", { species: "cat" })).toBe(`/?species=cat&region=${SEOUL}`);
  });

  it("쿠키 값이 깨져 있으면 기억이 없는 것으로 본다", () => {
    expect(entry("", { species: "", region: "몰라" })).toBe("/home");
    expect(entry("", { species: "panda", region: "몰라" })).toBe("/home");
    expect(entry("", { species: "cat", region: "몰라" })).toBe(`/?species=cat&region=${SEOUL}`);
  });

  it("채운 주소로 다시 들어오면 리다이렉트하지 않는다(루프 없음)", () => {
    const href = entry("", { species: "dog", region: BUSAN });
    expect(typeof href).toBe("string");
    const query = String(href).split("?")[1];
    expect(resolveAnimalListEntry(qs(query), { species: "dog", region: BUSAN }).kind).toBe("render");
  });
});

describe("homeHref: 목록에서 홈으로(결정 G2)", () => {
  it.each([
    [{ region: SEOUL }, `/home?region=${SEOUL}`],
    [{ region: SEOUL, district: JONGNO }, `/home?region=${SEOUL}&district=${JONGNO}`],
    [{}, "/home?region=all"],
  ])("%j → %j", (area, expected) => {
    expect(homeHref(area)).toBe(expected);
  });
});

describe("resolveHomeArea: 홈이 쓸 지역(결정 G2)", () => {
  it("넘겨받은 지역이 유효하면 그 지역이다", () => {
    expect(resolveHomeArea(qs(`region=${BUSAN}&district=${BUSAN_JUNG}`), SEOUL)).toEqual({
      region: BUSAN,
      district: BUSAN_JUNG,
    });
  });

  it("넘겨받은 지역이 없거나 쓸 수 없으면 기억된 지역이다", () => {
    expect(resolveHomeArea(qs(""), BUSAN)).toEqual({ region: BUSAN });
    expect(resolveHomeArea(qs("region=9999999"), BUSAN)).toEqual({ region: BUSAN });
  });

  it("둘 다 없으면 기본 지역(서울 전체)이다", () => {
    expect(resolveHomeArea(qs(""))).toEqual({ region: SEOUL });
    expect(resolveHomeArea(qs(""), "몰라")).toEqual({ region: SEOUL });
  });

  it("전국도 지역이다", () => {
    expect(resolveHomeArea(qs("region=all"), BUSAN)).toEqual({});
  });
});
