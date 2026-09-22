import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn(토큰 테마)", () => {
  it("글자 크기 토큰과 글자색 토큰을 함께 남긴다", () => {
    expect(cn("text-body text-text")).toBe("text-body text-text");
    expect(cn("text-badge", "text-status-protected-text")).toBe("text-badge text-status-protected-text");
    expect(cn("text-card-title text-text-2")).toBe("text-card-title text-text-2");
  });

  it("같은 그룹의 토큰끼리는 뒤의 것이 이긴다", () => {
    expect(cn("text-body", "text-caption")).toBe("text-caption");
    expect(cn("text-text", "text-text-2")).toBe("text-text-2");
    expect(cn("rounded-card", "rounded-pill")).toBe("rounded-pill");
    expect(cn("px-page", "px-4")).toBe("px-4");
    expect(cn("min-h-9", "min-h-touch")).toBe("min-h-touch");
    expect(cn("max-w-sm", "max-w-column")).toBe("max-w-column");
  });

  it("배경 토큰 덮어쓰기(사진 위 배지)", () => {
    expect(cn("bg-status-soon-bg", "bg-photo-pill")).toBe("bg-photo-pill");
  });
});
