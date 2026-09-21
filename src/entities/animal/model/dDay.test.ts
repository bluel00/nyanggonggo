import { describe, expect, it } from "vitest";
import type { Animal } from "./animal";
import { getDDay, isSoon } from "./dDay";

const kst = (iso: string) => new Date(`${iso}+09:00`);
const END = kst("2026-10-01T00:00:00");

const animal = (overrides: Partial<Animal> = {}): Animal => ({
  id: "1",
  species: "cat",
  images: [],
  status: "protected",
  noticeEndAt: END,
  sex: "unknown",
  ageText: null,
  regionText: "서울특별시",
  shelterName: null,
  foundPlaceText: null,
  noticePeriodText: null,
  ...overrides,
});

describe("getDDay", () => {
  it("기준일 2026-09-21, 종료일 2026-10-01 → 10", () => {
    expect(getDDay(animal(), kst("2026-09-21T00:00:00"))).toBe(10);
  });

  it("KST 달력 기준이라 같은 날의 시각에 영향받지 않는다", () => {
    expect(getDDay(animal(), kst("2026-09-21T23:59:59"))).toBe(10);
    // UTC로는 9월 20일이지만 KST로는 9월 21일 00:30
    expect(getDDay(animal(), new Date("2026-09-20T15:30:00Z"))).toBe(10);
    // UTC로는 9월 21일이지만 KST로는 9월 22일 00:30
    expect(getDDay(animal(), new Date("2026-09-21T15:30:00Z"))).toBe(9);
  });

  it("당일은 0", () => {
    expect(getDDay(animal(), kst("2026-10-01T18:00:00"))).toBe(0);
  });

  it("종료일이 지난 보호중 공고는 null", () => {
    expect(getDDay(animal(), kst("2026-10-02T00:00:00"))).toBeNull();
    expect(getDDay(animal(), kst("2026-10-05T09:00:00"))).toBeNull();
  });

  it("종료 공고는 종료일과 관계없이 null", () => {
    expect(getDDay(animal({ status: "ended" }), kst("2026-09-21T00:00:00"))).toBeNull();
  });

  it("noticeEndAt이 null이면 null", () => {
    expect(getDDay(animal({ noticeEndAt: null }), kst("2026-09-21T00:00:00"))).toBeNull();
  });
});

describe("isSoon", () => {
  it.each([
    ["2026-09-21T00:00:00", 10, false],
    ["2026-09-27T12:00:00", 4, false],
    ["2026-09-28T00:00:00", 3, true],
    ["2026-09-30T00:00:00", 1, true],
    ["2026-10-01T00:00:00", 0, true],
  ])("기준 %s (D-%i) → %s", (now, dDay, expected) => {
    expect(getDDay(animal(), kst(now))).toBe(dDay);
    expect(isSoon(animal(), kst(now))).toBe(expected);
  });

  it("dDay가 null이면 false(지난 보호중, 종료, 종료일 없음)", () => {
    expect(isSoon(animal(), kst("2026-10-02T00:00:00"))).toBe(false);
    expect(isSoon(animal({ status: "ended" }), kst("2026-09-30T00:00:00"))).toBe(false);
    expect(isSoon(animal({ noticeEndAt: null }), kst("2026-09-30T00:00:00"))).toBe(false);
  });
});
