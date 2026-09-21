/**
 * 아래 래퍼는 테스트용 합성 데이터다. 검증된 실제 응답이 아니다(architecture.md 12절 2).
 */
import { describe, expect, it } from "vitest";
import wrapperFixture from "../../../docs/fixtures/upstream-wrapper.json";
import { extractPage } from "./extract";

const wrap = (body: unknown, header: unknown = { resultCode: "00", resultMsg: "NORMAL SERVICE." }) => ({
  response: { header, body },
});

const A = { desertionNo: "1" };
const B = { desertionNo: "2" };

describe("extractPage", () => {
  it("item이 배열", () => {
    expect(extractPage(wrap({ items: { item: [A, B] }, totalCount: 2 }))).toEqual({
      items: [A, B],
      totalCount: 2,
      resultCode: "00",
    });
  });

  it("item이 단일 객체면 배열로 감싼다", () => {
    expect(extractPage(wrap({ items: { item: A }, totalCount: 1 }))?.items).toEqual([A]);
  });

  it("items가 빈 문자열이면 빈 배열", () => {
    expect(extractPage(wrap({ items: "", totalCount: 0 }))?.items).toEqual([]);
  });

  it("items 또는 item이 없으면 빈 배열", () => {
    expect(extractPage(wrap({ totalCount: 0 }))?.items).toEqual([]);
    expect(extractPage(wrap({ items: {} }))?.items).toEqual([]);
    expect(extractPage(wrap(undefined))?.items).toEqual([]);
    expect(extractPage(wrap({ items: { item: null } }))?.items).toEqual([]);
  });

  it("totalCount가 문자열이어도 숫자로 읽는다", () => {
    expect(extractPage(wrap({ items: "", totalCount: "2481" }))?.totalCount).toBe(2481);
  });

  it("totalCount가 없거나 숫자가 아니면 null", () => {
    expect(extractPage(wrap({ items: "" }))?.totalCount).toBeNull();
    expect(extractPage(wrap({ items: "", totalCount: "abc" }))?.totalCount).toBeNull();
    expect(extractPage(wrap({ items: "", totalCount: "" }))?.totalCount).toBeNull();
  });

  it("resultCode가 숫자여도 문자열로, 없으면 null", () => {
    expect(extractPage(wrap({}, { resultCode: 0 }))?.resultCode).toBe("0");
    expect(extractPage(wrap({}, null))?.resultCode).toBeNull();
  });

  it("최상위 response가 없으면 null(모양을 알 수 없는 응답)", () => {
    expect(extractPage({})).toBeNull();
    expect(extractPage(null)).toBeNull();
    expect(extractPage([])).toBeNull();
    expect(extractPage({ response: "x" })).toBeNull();
  });
});

describe("extractPage: 프로브로 확인한 구조(docs/fixtures/upstream-wrapper.json, 값은 합성)", () => {
  const { cases } = wrapperFixture;

  it("다건: item 배열, totalCount number, resultCode 00", () => {
    const page = extractPage(cases.multi.body);
    expect(page?.items).toHaveLength(2);
    expect(page?.totalCount).toBe(2);
    expect(page?.resultCode).toBe("00");
  });

  it("1건도 길이 1 배열로 온다", () => {
    const page = extractPage(cases.single.body);
    expect(Array.isArray(cases.single.body.response.body.items.item)).toBe(true);
    expect(page?.items).toHaveLength(1);
    expect(page?.totalCount).toBe(1);
  });

  it("0건: items가 {}이면 빈 배열, totalCount 0, resultCode 00", () => {
    expect(extractPage(cases.empty.body)).toEqual({ items: [], totalCount: 0, resultCode: "00" });
  });

  it("인증 오류 본문(OpenAPI_ServiceResponse)은 response가 없어 null", () => {
    expect(extractPage(cases.authError.body)).toBeNull();
  });
});
