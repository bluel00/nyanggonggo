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

  it.each([56, 112] as const)("가로 조합 %dpx(56 이상): 그림 파일 없이 부위를 나눈 인라인 SVG 하나(#115)", (size) => {
    const { container } = render(<Logo size={size} combo="lockup" />);
    expect(container.querySelectorAll("img")).toHaveLength(0);
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(1);
    expect(svgs[0].getAttribute("viewBox")).toBe("0 0 130.34 56");
    expect([svgs[0].getAttribute("width"), svgs[0].getAttribute("height")]).toEqual([String((130.34 * size) / 56), String(size)]);
    expect(screen.getByRole("img").dataset.variant).toBe("line");
  });

  it("인라인 가로 조합: 부위(data-part)가 모두 있고 입과 소리 선은 숨겨져 있다. id는 없다(handoff (k))", () => {
    const { container } = render(<Logo size={56} combo="lockup" />);
    const parts = [...container.querySelectorAll("[data-part]")].map((el) => el.getAttribute("data-part"));
    expect(parts.sort()).toEqual(["bark-lines", "cat", "cat-eyes", "dog", "dog-ear", "dog-eyes", "dog-mouth", "wordmark"]);
    for (const part of ["dog-mouth", "bark-lines"]) {
      expect(container.querySelector(`[data-part="${part}"]`)!.getAttribute("opacity"), part).toBe("0");
    }
    expect(container.querySelectorAll("[id]")).toHaveLength(0);
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
    const { container } = render(<Logo size={size} combo="lockup" />);
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("img", { name: SERVICE_NAME })).toBeTruthy();
    expect(SERVICE_NAME).toBe("멍냥공고");
    // 안쪽 그림(img·svg)은 모두 보조기기에서 숨긴다
    for (const drawing of container.querySelectorAll("[data-slot=logo] img, [data-slot=logo] svg")) {
      expect(drawing.closest('[aria-hidden="true"]'), drawing.tagName).not.toBeNull();
    }
  });

  it("그림 파일은 next/image 기본값(지연 로딩)이다(48px 가로 조합의 이름 부분)", () => {
    const { container } = render(<Logo size={48} combo="lockup" />);
    // 테스트에서 작은 파일(타일)은 data URL로 들어오고 next/image는 data URL을 지연 로딩하지 않아, 파일 주소인 이름 부분만 본다
    const name = [...container.querySelectorAll("img")].find((img) => img.getAttribute("src") === SOURCES["myeongnyang-lockup.svg"])!;
    expect(name.getAttribute("loading")).toBe("lazy");
    expect(name.getAttribute("fetchpriority")).toBeNull();
  });
});
