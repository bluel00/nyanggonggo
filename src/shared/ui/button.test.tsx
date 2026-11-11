// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./button";

afterEach(cleanup);

const classes = (element: HTMLElement) => element.className.split(" ");
/** 우리 variant가 함께 쓰는 포커스 방식: 2px focus-ring 바깥선, shadcn 링은 끈다 */
const FOCUS = ["focus-visible:outline-2", "focus-visible:outline-offset-2", "focus-visible:outline-ring", "focus-visible:ring-0"];

describe("Button (handoff (m), #126)", () => {
  it("기본은 <button>이고 variant primary, size touch다", () => {
    render(<Button>다시 시도</Button>);
    const button = screen.getByRole("button", { name: "다시 시도" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("data-slot")).toBe("button");
    expect(button.getAttribute("data-variant")).toBe("primary");
    expect(button.getAttribute("data-size")).toBe("touch");
    expect(classes(button)).toEqual(expect.arrayContaining(["bg-primary", "min-h-touch"]));
  });

  it("primary: text 채움 알약, 누르면 primary-pressed, 비활성은 disabled-bg·disabled-text(옅어지지 않음)", () => {
    render(<Button variant="primary">확인</Button>);
    expect(classes(screen.getByRole("button"))).toEqual(
      expect.arrayContaining([
        "rounded-pill",
        "bg-primary",
        "text-primary-foreground",
        "active:not-disabled:scale-press",
        "active:not-disabled:bg-primary-pressed",
        "disabled:bg-disabled-bg",
        "disabled:text-disabled-text",
        "disabled:opacity-100",
        ...FOCUS,
      ]),
    );
  });

  it("apply: 그라데이션 알약 + shadow-apply, 비활성은 그림자 없이 옅게", () => {
    render(<Button variant="apply">적용하기</Button>);
    expect(classes(screen.getByRole("button"))).toEqual(
      expect.arrayContaining([
        "rounded-pill",
        "bg-linear-135",
        "from-apply-from",
        "to-apply-to",
        "text-on-apply",
        "shadow-apply",
        "active:not-disabled:scale-press",
        "disabled:shadow-none",
        "disabled:opacity-50",
        ...FOCUS,
      ]),
    );
  });

  it("overlay: photo-pill 원, 누르면 bg", () => {
    render(<Button variant="overlay" size="icon-touch" aria-label="닫기" />);
    expect(classes(screen.getByRole("button", { name: "닫기" }))).toEqual(
      expect.arrayContaining(["rounded-pill", "bg-photo-pill", "text-text", "active:not-disabled:scale-press", "active:not-disabled:bg-bg", ...FOCUS]),
    );
  });

  it("surface: 흰 surface + shadow-control, 테두리 없음, 글자 text. 누르면 bg, 비활성은 disabled-bg에 그림자 없음", () => {
    render(<Button variant="surface">더 보기</Button>);
    const button = screen.getByRole("button", { name: "더 보기" });
    expect(button.getAttribute("data-variant")).toBe("surface");
    expect(classes(button)).toEqual(
      expect.arrayContaining([
        "rounded-pill",
        "border-0",
        "bg-surface",
        "text-text",
        "shadow-control",
        "active:not-disabled:scale-press",
        "active:not-disabled:bg-bg",
        "disabled:bg-disabled-bg",
        "disabled:shadow-none",
        ...FOCUS,
      ]),
    );
    // 공통의 1px 투명 테두리를 두지 않는다(폭이 내용 + 좌우 여백 그대로)
    expect(classes(button)).not.toContain("border");
  });

  it("size touch: 높이 44, 좌우 24, card-title 글자", () => {
    render(<Button size="touch">확인</Button>);
    const button = screen.getByRole("button");
    expect(classes(button)).toEqual(expect.arrayContaining(["min-h-touch", "px-6", "gap-1", "text-card-title"]));
    expect(classes(button)).not.toContain("text-sm");
  });

  it("size icon-touch: 44×44, 아이콘 22px", () => {
    render(<Button variant="overlay" size="icon-touch" aria-label="닫기" />);
    const button = screen.getByRole("button");
    expect(classes(button)).toEqual(expect.arrayContaining(["size-touch", "[&_svg:not([class*='size-'])]:size-[22px]"]));
    expect(classes(button)).not.toContain("[&_svg:not([class*='size-'])]:size-4");
    expect(button.getAttribute("data-size")).toBe("icon-touch");
  });

  it("size compact-touch(디자인 시스템 compact): 높이 44, 좌우 12, 글자 14/20 600, 아이콘 18px, 간격 6px", () => {
    render(
      <Button variant="surface" size="compact-touch">
        <svg data-testid="icon" aria-hidden />
        더 보기
      </Button>,
    );
    const button = screen.getByRole("button", { name: "더 보기" });
    expect(button.getAttribute("data-size")).toBe("compact-touch");
    expect(classes(button)).toEqual(
      expect.arrayContaining(["min-h-touch", "px-3", "gap-1.5", "text-body", "font-semibold", "[&_svg:not([class*='size-'])]:size-[18px]"]),
    );
    // 공통의 글자 크기·굵기·아이콘 크기와 섞이지 않는다
    for (const dropped of ["text-sm", "font-medium", "[&_svg:not([class*='size-'])]:size-4"]) expect(classes(button)).not.toContain(dropped);
  });

  it("지운 shadcn variant·크기는 타입에 없다", () => {
    // @ts-expect-error 지운 variant
    render(<Button variant="ghost">a</Button>);
    // @ts-expect-error 지운 크기
    render(<Button size="icon-sm">b</Button>);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("asChild면 넘긴 요소를 그리고 버튼 모양과 data 속성을 그 요소에 붙인다", () => {
    render(
      <Button asChild variant="overlay" size="icon-touch" className="bg-bg">
        <a href="#top" aria-label="뒤로가기" />
      </Button>,
    );
    const link = screen.getByRole("link", { name: "뒤로가기" });
    expect(link.getAttribute("href")).toBe("#top");
    expect(link.getAttribute("data-slot")).toBe("button");
    expect(link.getAttribute("data-variant")).toBe("overlay");
    expect(classes(link)).toEqual(expect.arrayContaining(["size-touch", "rounded-pill"]));
    expect(document.querySelector("button")).toBeNull();
  });

  it("className은 뒤에 합쳐져 같은 속성을 덮어쓰고, 나머지 props는 그대로 넘어간다", () => {
    const onClick = vi.fn();
    render(
      <Button variant="overlay" size="icon-touch" className="bg-bg" disabled={false} onClick={onClick} aria-label="뒤로가기" />,
    );
    const button = screen.getByRole("button");
    expect(classes(button)).toContain("bg-bg");
    expect(classes(button)).not.toContain("bg-photo-pill");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
