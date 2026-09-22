// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageViewer } from "./image-viewer";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const images = [1, 2, 3].map((n) => `http://openapi.animal.go.kr/openapi/files/${n}.jpg`);

function swipeTo(track: HTMLElement, slide: number, width = 390) {
  Object.defineProperty(track, "clientWidth", { configurable: true, value: width });
  Object.defineProperty(track, "scrollLeft", { configurable: true, writable: true, value: slide * width });
  fireEvent.scroll(track);
}

describe("ImageViewer", () => {
  it("480px 컬럼이 있으면 그 안에 포털하고 fixed가 아니라 absolute로 덮는다", () => {
    const column = document.createElement("div");
    column.setAttribute("data-slot", "app-column");
    document.body.appendChild(column);
    render(<ImageViewer images={images} alt="고양이 사진" initialIndex={0} onClose={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "사진 크게 보기" });
    expect(column.contains(dialog)).toBe(true);
    expect(dialog.className).toContain("absolute");
    expect(dialog.className).not.toContain("fixed");
    expect(dialog.className).toContain("bg-viewer-bg");
  });

  it("시작 위치의 페이지 표시, 사진은 원본 비율(contain)", () => {
    render(<ImageViewer images={images} alt="고양이 사진" initialIndex={1} onClose={() => {}} />);
    expect(screen.getByText("2/3")).toBeTruthy();
    expect(screen.getByRole("img", { name: "고양이 사진 1" }).className).toContain("object-contain");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "닫기" }));
  });

  it("스와이프한 뒤 X로 닫으면 마지막 위치를 돌려준다", () => {
    const onClose = vi.fn();
    const { container } = render(<ImageViewer images={images} alt="a" initialIndex={0} onClose={onClose} />);
    const track = document.querySelector<HTMLElement>('[data-slot="image-viewer"] > div')!;
    swipeTo(track, 2);
    expect(screen.getByText("3/3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledWith(2);
    expect(container).toBeTruthy();
  });

  it("Esc로 닫는다", () => {
    const onClose = vi.fn();
    render(<ImageViewer images={images} alt="a" initialIndex={1} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledWith(1);
  });

  it("1장이면 페이지 표시가 없다", () => {
    render(<ImageViewer images={[images[0]]} alt="a" initialIndex={0} onClose={() => {}} />);
    expect(screen.queryByText("1/1")).toBeNull();
  });
});
