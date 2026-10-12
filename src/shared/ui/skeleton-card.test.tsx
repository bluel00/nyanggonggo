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
});
