import { describe, expect, it } from "vitest";
import type { Animal } from "../model/animal";
import { statusBadgeText } from "./status-text";
import { makeAnimal } from "@tests/factories/animal";

const kst = (iso: string) => new Date(`${iso}+09:00`);
const NOW = kst("2026-09-21T09:00:00");

describe("statusBadgeText", () => {
  const at = (end: string | null, overrides: Partial<Animal> = {}) =>
    makeAnimal({ noticeEndAt: end === null ? null : kst(`${end}T00:00:00`), ...overrides });

  it("당일은 D-day, 종료는 D-day를 붙이지 않는다", () => {
    expect(statusBadgeText(at("2026-09-21"), NOW)).toBe("임박 · D-day");
    expect(statusBadgeText(at("2026-09-26", { status: "ended" }), NOW)).toBe("종료");
    expect(statusBadgeText(at(null), NOW)).toBe("보호중");
  });

  it("dDay: false면 D-day를 붙이지 않는다(상세·OG 배지)", () => {
    expect(statusBadgeText(at("2026-09-21"), NOW, { dDay: false })).toBe("임박");
    expect(statusBadgeText(at("2026-10-01"), NOW, { dDay: false })).toBe("보호중");
  });

  // 이슈 #41: 종료 결과는 processState 괄호 안 원문이다. 값 목록을 고정하지 않는다
  it.each([
    ["결과 있음", "입양", "종료 · 입양"],
    ["결과 없음", null, "종료"],
    ["처음 보는 값도 그대로", "임시보호연계", "종료 · 임시보호연계"],
  ] as const)("종료 + %s", (_label, endResultText, expected) => {
    const ended = at("2026-09-26", { status: "ended", endResultText });
    expect(statusBadgeText(ended, NOW)).toBe(expected);
    expect(statusBadgeText(ended, NOW, { dDay: false })).toBe(expected);
  });

  it("보호중 공고에 결과 값이 있어도 쓰지 않는다", () => {
    expect(statusBadgeText(at("2026-10-01", { endResultText: "입양" }), NOW)).toBe("보호중 · D-10");
  });
});
