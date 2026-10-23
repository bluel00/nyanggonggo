import { describe, expect, it } from "vitest";
import { isAnimalId } from "./animals";

describe("isAnimalId", () => {
  it("숫자 문자열 1~32자리만 공고 id다", () => {
    expect(isAnimalId("450650202602282")).toBe(true);
    expect(isAnimalId("1")).toBe(true);
    expect(isAnimalId("1".repeat(32))).toBe(true);
  });

  it.each(["", "1".repeat(33), "abc", "12a", " 12", "12\n", "-1", "1.5"])("%j는 아니다", (value) => {
    expect(isAnimalId(value)).toBe(false);
  });
});
