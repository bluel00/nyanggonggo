// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LoadingCharacter } from "./loading-character";

afterEach(cleanup);

describe("LoadingCharacter(handoff (j) L2·L5)", () => {
  it.each(["cat", "dog"] as const)("%s: 96px 그림(aria-hidden) 아래 문구, 나타나는 때는 CSS(data-loading-wait)가 정한다", (species) => {
    const { container } = render(<LoadingCharacter species={species} />);
    const root = container.querySelector('[data-slot="loading-character"]')!;
    expect(root.hasAttribute("data-loading-wait")).toBe(true);
    expect(root.getAttribute("data-species")).toBe(species);
    expect(root.className).toContain("gap-2.5");

    const svg = root.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("viewBox")).toBe("0 0 120 120");
    expect(svg.getAttribute("width")).toBe("96");
    expect(screen.getByText("공고를 불러오고 있어요").className).toBe("text-body text-text-2");
  });

  it.each(["cat", "dog"] as const)("%s: 숨쉬기·깜빡임·꼬리 그룹이 하나씩 있고 기준점이 있다", (species) => {
    const { container } = render(<LoadingCharacter species={species} />);
    const motions = [...container.querySelectorAll<SVGGElement>("[data-loading-motion]")];
    expect(motions.map((g) => g.dataset.loadingMotion).sort()).toEqual(["blink", "breathe", "tail"]);
    expect(container.querySelector<SVGGElement>('[data-loading-motion="breathe"]')!.style.transformOrigin).toBe("60px 112px");
    expect(container.querySelector<SVGGElement>('[data-loading-motion="tail"]')!.style.transformOrigin).toBe("0px 0px");
    // id가 없어 문서 안에서 겹치지 않는다
    expect(container.querySelectorAll("[id]")).toHaveLength(0);
  });
});
