// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SkeletonCard } from "./skeleton-card";

afterEach(cleanup);

describe("SkeletonCard", () => {
  it("사진 칸은 AnimalCard와 같은 1:1이다(로딩 → 카드에서 높이가 바뀌지 않게)", () => {
    const { container } = render(<SkeletonCard />);
    const photo = container.querySelector('[data-slot="skeleton-card"]')!.firstElementChild!;
    expect(photo.className).toContain("aspect-square");
  });

  it("글줄은 셋이고 AnimalCard 글자 칸과 같은 줄 상자다(제목 24 · 보조 20 · 공고 번호 16, 사이 2px)", () => {
    const { container } = render(<SkeletonCard />);
    const lines = [...container.querySelectorAll('[data-slot="skeleton-line"]')].map((line) => line.className);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("h-6");
    expect(lines[1]).toMatch(/\bmt-0\.5\b.*\bh-5\b/);
    expect(lines[2]).toMatch(/\bmt-0\.5\b.*\bh-4\b/);
    expect(lines[0]).not.toContain("mt-");
    expect(container.querySelector('[data-slot="skeleton-line"]')!.parentElement!.className).toBe("px-3 pt-2.5 pb-3");
  });
});
