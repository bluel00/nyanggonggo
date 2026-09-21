import { describe, expect, it } from "vitest";
import { InvalidRequestError } from "./errors";
import { parseAnimalId, parseIdsQuery, parseListQuery } from "./query";

const qs = (s: string) => new URLSearchParams(s);

describe("parseListQuery", () => {
  it("기본값: species=cat, status=protected, sort=latest", () => {
    expect(parseListQuery(qs(""))).toEqual({ species: "cat", status: "protected", sort: "latest" });
  });

  it("빈 문자열은 값이 없는 것으로 본다", () => {
    expect(parseListQuery(qs("species=&status=&region=&cursor="))).toEqual({
      species: "cat",
      status: "protected",
      sort: "latest",
    });
  });

  it("모든 값을 읽는다", () => {
    expect(parseListQuery(qs("species=dog&region=6260000&status=ended&sort=endingSoon&cursor=MjA"))).toEqual({
      species: "dog",
      region: "6260000",
      status: "ended",
      sort: "endingSoon",
      cursor: "MjA",
    });
  });

  it("status=all을 받는다(architecture.md 10절)", () => {
    expect(parseListQuery(qs("status=all")).status).toBe("all");
  });

  it("알 수 없는 파라미터(page 등)는 무시한다", () => {
    expect(parseListQuery(qs("page=3"))).toEqual({ species: "cat", status: "protected", sort: "latest" });
  });

  it.each(["species=bird", "status=notice", "sort=oldest", "region=부산", "region=26-00", "species=CAT"])(
    "잘못된 값 %s → InvalidRequestError",
    (query) => {
      expect(() => parseListQuery(qs(query))).toThrow(InvalidRequestError);
    },
  );
});

describe("parseAnimalId", () => {
  it("숫자 문자열만 받는다", () => {
    expect(parseAnimalId("450650202602282")).toBe("450650202602282");
    for (const bad of ["", "abc", "1 2", "../x", "1".repeat(33)]) {
      expect(() => parseAnimalId(bad)).toThrow(InvalidRequestError);
    }
  });
});

describe("parseIdsQuery", () => {
  it("쉼표로 나누고 공백과 빈 항목을 버린다", () => {
    expect(parseIdsQuery(qs("ids=1, 2,,3,"), 50)).toEqual(["1", "2", "3"]);
  });

  it("비었거나 최대 개수를 넘거나 형식이 틀리면 InvalidRequestError", () => {
    expect(() => parseIdsQuery(qs(""), 50)).toThrow(InvalidRequestError);
    expect(() => parseIdsQuery(qs("ids=,,"), 50)).toThrow(InvalidRequestError);
    expect(() => parseIdsQuery(qs("ids=1,2,3"), 2)).toThrow(InvalidRequestError);
    expect(() => parseIdsQuery(qs("ids=1,x"), 50)).toThrow(InvalidRequestError);
  });
});
