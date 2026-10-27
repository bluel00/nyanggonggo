import { describe, expect, it } from "vitest";
import type { Animal } from "../model/animal";
import { cardDeadlineText, deadlineDateText, detailDeadlineText, statusBadgeText, statusDisplayGlyphs, statusShareText } from "./status-text";
import { makeAnimal } from "@tests/factories/animal";

const kst = (iso: string) => new Date(`${iso}+09:00`);
const NOW = kst("2026-09-21T09:00:00");
const at = (end: string | null, overrides: Partial<Animal> = {}) =>
  makeAnimal({ noticeEndAt: end === null ? null : kst(`${end}T00:00:00`), ...overrides });

describe("앱 안 마감 표기(상대)", () => {
  it("카드: '마감 D-N', 당일 '오늘 마감'", () => {
    expect(cardDeadlineText(10)).toBe("마감 D-10");
    expect(cardDeadlineText(1)).toBe("마감 D-1");
    expect(cardDeadlineText(0)).toBe("오늘 마감");
  });

  it("상세: '공고 마감 D-N', 당일 '오늘 마감'", () => {
    expect(detailDeadlineText(10)).toBe("공고 마감 D-10");
    expect(detailDeadlineText(0)).toBe("오늘 마감");
  });
});

describe("deadlineDateText: 밖으로 나가는 마감 표기(날짜)", () => {
  it("형식은 정확히 '공고 마감 M월 D일(요)': 0을 붙이지 않고, '일('을 붙여 쓴다", () => {
    expect(deadlineDateText(kst("2026-01-01T00:00:00"))).toBe("공고 마감 1월 1일(목)");
    expect(deadlineDateText(kst("2026-11-05T00:00:00"))).toBe("공고 마감 11월 5일(목)");
    expect(deadlineDateText(kst("2026-12-25T00:00:00"))).toBe("공고 마감 12월 25일(금)");
  });

  it.each([
    ["2026-10-25", "일"],
    ["2026-10-26", "월"],
    ["2026-10-27", "화"],
    ["2026-10-28", "수"],
    ["2026-10-29", "목"],
    ["2026-10-30", "금"],
    ["2026-10-31", "토"],
  ])("%s → 요일 %s(한 글자)", (date, weekday) => {
    expect(deadlineDateText(kst(`${date}T00:00:00`))).toBe(`공고 마감 ${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일(${weekday})`);
  });

  it("KST로 자른다: UTC 기준 전날 15:00 전후(KST 자정 전후)", () => {
    // 2026-10-31 14:59:59Z = KST 10월 31일 23:59:59, 15:00:00Z = KST 11월 1일 00:00:00
    expect(deadlineDateText(new Date("2026-10-31T14:59:59Z"))).toBe("공고 마감 10월 31일(토)");
    expect(deadlineDateText(new Date("2026-10-31T15:00:00Z"))).toBe("공고 마감 11월 1일(일)");
  });
});

describe("statusBadgeText: 앱 안 상태 표기", () => {
  it("보호중 + 마감 D-N, 당일 '오늘 마감', 마감이 가까워도 '임박'이라 쓰지 않는다", () => {
    expect(statusBadgeText(at("2026-10-01"), NOW)).toBe("보호중 · 마감 D-10");
    expect(statusBadgeText(at("2026-09-23"), NOW)).toBe("보호중 · 마감 D-2");
    expect(statusBadgeText(at("2026-09-21"), NOW)).toBe("보호중 · 오늘 마감");
  });

  it("종료·마감일 없음·마감이 지난 공고에는 마감 표기를 붙이지 않는다", () => {
    expect(statusBadgeText(at("2026-09-26", { status: "ended" }), NOW)).toBe("종료");
    expect(statusBadgeText(at(null), NOW)).toBe("보호중");
    expect(statusBadgeText(at("2026-09-20"), NOW)).toBe("보호중");
  });

  it("dDay: false면 마감 표기를 붙이지 않는다(상세 배지, OG 상태 칩)", () => {
    expect(statusBadgeText(at("2026-09-21"), NOW, { dDay: false })).toBe("보호중");
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
    expect(statusShareText(ended, NOW)).toBe(expected);
  });

  it("보호중 공고에 결과 값이 있어도 쓰지 않는다", () => {
    expect(statusBadgeText(at("2026-10-01", { endResultText: "입양" }), NOW)).toBe("보호중 · 마감 D-10");
  });
});

describe("statusShareText: 밖으로 나가는 상태 표기(날짜)", () => {
  it("마감 전 보호중만 날짜를 붙인다(당일 포함)", () => {
    expect(statusShareText(at("2026-10-01"), NOW)).toBe("보호중 · 공고 마감 10월 1일(목)");
    expect(statusShareText(at("2026-09-21"), NOW)).toBe("보호중 · 공고 마감 9월 21일(월)");
  });

  it("마감이 지났거나 마감일이 없으면 '보호중', 종료는 '종료'", () => {
    expect(statusShareText(at("2026-09-20"), NOW)).toBe("보호중");
    expect(statusShareText(at(null), NOW)).toBe("보호중");
    expect(statusShareText(at("2026-10-01", { status: "ended" }), NOW)).toBe("종료");
  });
});

describe("statusDisplayGlyphs: 앱 안에 보이는 글자만(날짜 글자는 넣지 않는다)", () => {
  it("상태 낱말, 마감 표기, 숫자. '임박'·'D-day'는 없다", () => {
    const glyphs = statusDisplayGlyphs({ endResultText: null });
    for (const word of ["보호중", "종료", "·", "오늘 마감", "공고 마감 D-", "0123456789"]) expect(glyphs).toContain(word);
    expect(glyphs).not.toMatch(/임박|D-day|월|일\(/);
  });

  it("종료 결과는 그 공고의 것을 더한다", () => {
    expect(statusDisplayGlyphs({ endResultText: "입양" })).toContain("입양");
  });
});
