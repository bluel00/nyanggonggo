// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageCarousel } from "./image-carousel";

afterEach(cleanup);

const img = (n: number) => `http://openapi.animal.go.kr/openapi/files/${n}.jpg`;

/** 부모처럼 index를 들고 있는 래퍼 */
function Harness({ images, onOpen = () => {} }: { images: string[]; onOpen?: (i: number) => void }) {
  const [index, setIndex] = useState(0);
  return (
    <>
      <ImageCarousel images={images} alt="고양이 사진" ended={false} index={index} onIndexChange={setIndex} onOpen={onOpen} />
      <output data-testid="index">{index}</output>
    </>
  );
}

/** jsdom에는 레이아웃이 없어 트랙 폭과 스크롤 위치를 직접 준다 */
function swipeTo(track: HTMLElement, slide: number, width = 390) {
  Object.defineProperty(track, "clientWidth", { configurable: true, value: width });
  Object.defineProperty(track, "scrollLeft", { configurable: true, writable: true, value: slide * width });
  fireEvent.scroll(track);
}

describe("ImageCarousel", () => {
  it("여러 장이면 scroll-snap 트랙과 도트, 스와이프하면 현재 위치와 도트가 바뀐다", () => {
    const { container } = render(<Harness images={[img(1), img(2), img(3)]} />);
    const track = container.querySelector<HTMLElement>('[data-slot="image-carousel"]')!;
    expect(track.className).toContain("snap-x");
    const dots = () => [...container.querySelectorAll('[data-slot="carousel-dots"] span')].map((d) => d.getAttribute("data-current"));
    expect(dots()).toEqual(["true", "false", "false"]);

    swipeTo(track, 2);
    expect(screen.getByTestId("index").textContent).toBe("2");
    expect(dots()).toEqual(["false", "false", "true"]);
  });

  it("1장이면 도트 없이 정적", () => {
    const { container } = render(<Harness images={[img(1)]} />);
    expect(container.querySelector('[data-slot="carousel-dots"]')).toBeNull();
    expect(screen.getByRole("button", { name: "사진 크게 보기" })).toBeTruthy();
  });

  it("사진이 없으면 카드와 같은 대체 UI(탭해도 뷰어를 열지 않음)", () => {
    render(<Harness images={[]} />);
    expect(screen.getByRole("img", { name: "고양이 사진" }).tagName).toBe("DIV");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("사진을 탭하면 그 위치로 onOpen", () => {
    const onOpen = vi.fn();
    render(<Harness images={[img(1), img(2)]} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "사진 크게 보기 (2/2)" }));
    expect(onOpen).toHaveBeenCalledWith(1);
  });

  it("부모가 index를 바꾸면 그 사진으로 스크롤한다", () => {
    const { container, rerender } = render(
      <ImageCarousel images={[img(1), img(2), img(3)]} alt="a" ended={false} index={0} onIndexChange={() => {}} onOpen={() => {}} />,
    );
    const track = container.querySelector<HTMLElement>('[data-slot="image-carousel"]')!;
    Object.defineProperty(track, "clientWidth", { configurable: true, value: 390 });
    track.scrollTo = vi.fn();
    rerender(<ImageCarousel images={[img(1), img(2), img(3)]} alt="a" ended={false} index={2} onIndexChange={() => {}} onOpen={() => {}} />);
    expect(track.scrollTo).toHaveBeenCalledWith({ left: 780 });
  });
});
