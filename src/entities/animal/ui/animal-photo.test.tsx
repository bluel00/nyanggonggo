// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IMAGE_SOURCE_PREFIX } from "@/contract/images";
import { AnimalPhoto, PHOTO_SIZES } from "./animal-photo";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** 허용 원본(계약의 접두어) 아래 지어낸 경로 */
const SRC = `${IMAGE_SOURCE_PREFIX}e2e-fixture/photo.jpg`;
const layer = (container: HTMLElement) => container.querySelector('[data-slot="photo-loading"]');

/** img.complete·naturalWidth·currentSrc를 흉내 낸다(jsdom은 이미지를 받지 않는다) */
function fakeImage({ complete, naturalWidth, currentSrc = "" }: { complete: boolean; naturalWidth: number; currentSrc?: string }) {
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(complete);
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(naturalWidth);
  vi.spyOn(HTMLImageElement.prototype, "currentSrc", "get").mockReturnValue(currentSrc);
}

describe("AnimalPhoto 사진 로딩 시머(handoff (j) L4)", () => {
  it("로드될 때까지 사진 아래에 시머 층이 있고, load 때 빠진다", () => {
    const { container } = render(<AnimalPhoto src={SRC} alt="사진" sizes={PHOTO_SIZES.card} shimmer />);
    const shimmer = layer(container)!;
    expect(shimmer.hasAttribute("data-shimmer")).toBe(true);
    expect(shimmer.getAttribute("aria-hidden")).toBe("true");
    expect(shimmer.className).toContain("bg-status-ended-bg");
    // 층이 사진보다 앞(아래)에 있고 사진은 relative라 그 위에 칠해진다
    const img = container.querySelector("img")!;
    expect(shimmer.nextElementSibling).toBe(img);
    expect(img.className).toContain("relative");

    fireEvent.load(img);
    expect(layer(container)).toBeNull();
  });

  it("마운트 때 이미 로드된 사진(캐시, 하이드레이션 전에 끝난 load)은 시머 없이 그린다", () => {
    fakeImage({ complete: true, naturalWidth: 400, currentSrc: SRC });
    const { container } = render(<AnimalPhoto src={SRC} alt="사진" shimmer />);
    expect(layer(container)).toBeNull();
  });

  it("마운트 때 이미 실패한 사진은 대체 UI(시머 없음)다", () => {
    fakeImage({ complete: true, naturalWidth: 0, currentSrc: SRC });
    const { container } = render(<AnimalPhoto src={SRC} alt="사진" shimmer />);
    expect(container.querySelector('[role="img"][aria-label="사진"]')).not.toBeNull();
    expect(layer(container)).toBeNull();
  });

  it("아직 받지 않은 지연 로딩 사진(currentSrc 없음)은 실패로 보지 않는다", () => {
    fakeImage({ complete: true, naturalWidth: 0 });
    const { container } = render(<AnimalPhoto src={SRC} alt="사진" shimmer />);
    expect(container.querySelector("img")).not.toBeNull();
    expect(layer(container)).not.toBeNull();
  });

  it("실패하면 대체 UI만이고 시머가 없다", () => {
    const { container } = render(<AnimalPhoto src={SRC} alt="사진" shimmer />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector('[role="img"][aria-label="사진"]')).not.toBeNull();
    expect(layer(container)).toBeNull();
  });

  it("사진이 없으면 대체 UI이고 시머가 없다. shimmer를 켜지 않으면(풀스크린 뷰어) 층이 없다", () => {
    const empty = render(<AnimalPhoto src={null} alt="사진" shimmer />);
    expect(layer(empty.container)).toBeNull();
    cleanup();
    const viewer = render(<AnimalPhoto src={SRC} alt="사진" fit="contain" />);
    expect(layer(viewer.container)).toBeNull();
    expect(viewer.container.querySelector("img")!.className).not.toContain("relative");
  });
});
