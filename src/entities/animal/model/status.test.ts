import { describe, expect, it } from "vitest";
import type { Animal } from "./animal";
import { getPrimaryImage, getStatusVariant } from "./status";

const kst = (iso: string) => new Date(`${iso}+09:00`);
const NOW = kst("2026-09-21T09:00:00");
const at = (status: Animal["status"], end: string | null) => ({
  status,
  noticeEndAt: end === null ? null : kst(`${end}T00:00:00`),
});

describe("getStatusVariant", () => {
  it.each([
    ["종료 공고", at("ended", "2026-09-22"), "ended"],
    ["D-10 보호중", at("protected", "2026-10-01"), "protected"],
    ["D-3 보호중은 임박", at("protected", "2026-09-24"), "soon"],
    ["당일(D-day)은 임박", at("protected", "2026-09-21"), "soon"],
    ["종료일이 지난 보호중은 보호중(dDay null)", at("protected", "2026-09-20"), "protected"],
    ["종료일 없는 보호중", at("protected", null), "protected"],
  ] as const)("%s → %s", (_label, animal, expected) => {
    expect(getStatusVariant(animal, NOW)).toBe(expected);
  });
});

describe("getPrimaryImage", () => {
  it("첫 번째 사진, 없으면 null", () => {
    expect(getPrimaryImage({ images: ["a", "b"] })).toBe("a");
    expect(getPrimaryImage({ images: [] })).toBeNull();
  });
});
