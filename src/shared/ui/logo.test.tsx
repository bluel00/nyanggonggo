// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import lockup from "@/shared/assets/logo/myeongnyang-lockup.svg";
import mark from "@/shared/assets/logo/myeongnyang-mark.svg";
import tileSmall from "@/shared/assets/logo/myeongnyang-tile-small.svg";
import tile from "@/shared/assets/logo/myeongnyang-tile.svg";
import { SERVICE_NAME } from "@/shared/config/service";
import { Logo, logoVariant } from "./logo";

afterEach(cleanup);

function srcOf(module: string | { src: string }) {
  return typeof module === "string" ? module : module.src;
}

/** 원본 SVG 파일 이름 ↔ 가져온 주소(테스트에서는 작은 파일이 data URL로 들어온다) */
const SOURCES: Record<string, string> = {
  "myeongnyang-lockup.svg": srcOf(lockup),
  "myeongnyang-mark.svg": srcOf(mark),
  "myeongnyang-tile-small.svg": srcOf(tileSmall),
  "myeongnyang-tile.svg": srcOf(tile),
};

/** 그린 그림의 원본 파일 이름 */
const files = (container: HTMLElement) =>
  [...container.querySelectorAll("img")].map(
    (img) => Object.entries(SOURCES).find(([, src]) => src === img.getAttribute("src"))?.[0],
  );

describe("logoVariant: 크기로 변형을 고른다", () => {
  it.each([
    [16, "tile-small"],
    [24, "tile-small"],
    [25, "tile"],
    [32, "tile"],
    [48, "tile"],
    [55, "tile"],
    [56, "line"],
    [96, "line"],
  ] as const)("%dpx → %s", (size, variant) => {
    expect(logoVariant(size)).toBe(variant);
  });
});

describe("Logo", () => {
  it.each([
    [16, "myeongnyang-tile-small.svg"],
    [24, "myeongnyang-tile-small.svg"],
    [32, "myeongnyang-tile.svg"],
    [48, "myeongnyang-tile.svg"],
    [56, "myeongnyang-mark.svg"],
    [96, "myeongnyang-mark.svg"],
  ] as const)("상징만 %dpx: %s 하나를 그 크기로", (size, file) => {
    const { container } = render(<Logo size={size} />);
    expect(files(container)).toEqual([file]);
    const img = container.querySelector("img")!;
    expect([img.getAttribute("width"), img.getAttribute("height")]).toEqual([String(size), String(size)]);
  });

  it("가로 조합 56px 이상: 원본 가로 조합(line + 이름) 그대로", () => {
    const { container } = render(<Logo size={56} combo="lockup" />);
    expect(files(container)).toEqual(["myeongnyang-lockup.svg"]);
    expect(container.querySelector("img")!.getAttribute("height")).toBe("56");
    expect(screen.getByRole("img").dataset.variant).toBe("line");
  });

  it.each([
    [24, "myeongnyang-tile-small.svg"],
    [48, "myeongnyang-tile.svg"],
  ] as const)("가로 조합 %dpx(56 미만): line을 쓰지 않고 타일(%s) + 이름", (size, tile) => {
    const { container } = render(<Logo size={size} combo="lockup" />);
    expect(files(container)).toEqual([tile, "myeongnyang-lockup.svg"]);
    expect(files(container)).not.toContain("myeongnyang-mark.svg");
    expect(screen.getByRole("img").dataset.variant).not.toBe("line");
  });

  it.each([16, 56] as const)("접근성 이름은 서비스 이름 하나(%dpx), 안쪽 그림은 읽히지 않는다", (size) => {
    render(<Logo size={size} combo="lockup" />);
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("img", { name: SERVICE_NAME })).toBeTruthy();
    expect(SERVICE_NAME).toBe("멍냥공고");
  });
});
