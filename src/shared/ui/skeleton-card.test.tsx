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

  it("사진 칸과 막대 셋에 첫 프레임부터 로딩 시머가 있다(handoff (j) L1)", () => {
    const { container } = render(<SkeletonCard />);
    const shimmering = [...container.querySelectorAll("[data-shimmer]")];
    expect(shimmering).toHaveLength(4);
    expect(shimmering[0].getAttribute("data-slot")).toBe("skeleton-photo");
  });

  it("기본은 카드 전체를 읽기에서 숨기고, wait가 있으면 사진 칸 가운데에 두고 막대만 숨긴다", () => {
    const plain = render(<SkeletonCard />).container.firstElementChild!;
    expect(plain.getAttribute("aria-hidden")).toBe("true");
    cleanup();

    const { container } = render(<SkeletonCard wait={<p>기다려요</p>} />);
    const card = container.firstElementChild!;
    expect(card.hasAttribute("aria-hidden")).toBe(false);
    expect(container.querySelector("[data-slot=\"skeleton-photo\"]")!.textContent).toBe("기다려요");
    expect(container.querySelector("[data-slot=\"skeleton-line\"]")!.parentElement!.getAttribute("aria-hidden")).toBe("true");
  });
});
