import { describe, expect, it } from "vitest";
import { PHOTO_BOX_RATIO, photoBoxRatio } from "./photo-box";

describe("photoBoxRatio(상세 사진 칸 비율, PRD v1.3)", () => {
  it.each([
    [0.63, 0.75],
    [1.0, 1.0],
    [1.49, 4 / 3],
  ])("첫 사진 비율 %s → 칸 %s(3:4~4:3으로 제한)", (ratio, expected) => {
    expect(photoBoxRatio({ width: ratio * 1000, height: 1000 })).toBeCloseTo(expected, 3);
  });

  it("범위 안이면 첫 사진 비율 그대로(4:3 가로 1600×1200, 3:4 세로 1300×1733)", () => {
    expect(photoBoxRatio({ width: 1600, height: 1200 })).toBeCloseTo(4 / 3, 6);
    expect(photoBoxRatio({ width: 1300, height: 1733 })).toBeCloseTo(1300 / 1733, 6);
  });

  it("크기를 모르면(null) 1:1", () => {
    expect(photoBoxRatio(null)).toBe(PHOTO_BOX_RATIO.unknown);
    expect(photoBoxRatio(undefined)).toBe(1);
  });

  it("크기가 0이거나 숫자가 아니면 1:1", () => {
    expect(photoBoxRatio({ width: 0, height: 100 })).toBe(1);
    expect(photoBoxRatio({ width: 100, height: Number.NaN })).toBe(1);
  });
});
