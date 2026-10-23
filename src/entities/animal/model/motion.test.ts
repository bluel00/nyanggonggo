import { describe, expect, it } from "vitest";
import { allowsMotion } from "./motion";

describe("allowsMotion", () => {
  it("보호 중 공고는 움직인다", () => {
    expect(allowsMotion({ status: "protected" })).toBe(true);
  });

  it("종료 공고는 움직이지 않는다", () => {
    expect(allowsMotion({ status: "ended" })).toBe(false);
  });

  it("움직임 줄이기면 보호 중이어도 움직이지 않는다", () => {
    expect(allowsMotion({ status: "protected" }, true)).toBe(false);
    expect(allowsMotion({ status: "ended" }, true)).toBe(false);
  });
});
