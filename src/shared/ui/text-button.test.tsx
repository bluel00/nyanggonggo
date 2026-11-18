// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TextButton } from "./text-button";

afterEach(cleanup);

const Icon = () => <svg data-testid="icon" aria-hidden />;
const label = (element: HTMLElement) => element.querySelector('[data-slot="text-button-label"]')!;
const arrow = (element: HTMLElement) => element.querySelector('[data-slot="text-button-arrow"]');

describe("TextButton (handoff (l), #127)", () => {
  it("기본은 type=button인 <button>이고 밑줄 variant, caption 크기다. 글자 text 600, 누르는 영역 44px", () => {
    render(<TextButton>보기</TextButton>);
    const button = screen.getByRole("button", { name: "보기" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
    expect(button.getAttribute("data-variant")).toBe("underline");
    expect(button.getAttribute("data-size")).toBe("caption");
    expect(button.className.split(" ")).toEqual(
      expect.arrayContaining([
        "text-caption",
        "font-semibold",
        "text-text",
        "active:not-disabled:text-text-2",
        "hover:not-disabled:text-text-2",
        "-my-3",
        "min-h-11",
        "min-w-11",
      ]),
    );
    expect(button.className.split(" ")).not.toContain("text-body");
  });

  it("asChild면 넘긴 <a>를 그리고, 아이콘·글자가 그 <a> 안에 들어간다(href·aria-label·data-slot은 <a>의 것)", () => {
    render(
      <TextButton asChild icon={<Icon />}>
        <a href="tel:0000" aria-label="전화 걸기" data-slot="contact-link">
          전화
        </a>
      </TextButton>,
    );
    const link = screen.getByRole("link", { name: "전화 걸기" });
    expect(link.getAttribute("href")).toBe("tel:0000");
    expect(link.getAttribute("type")).toBeNull();
    expect(link.getAttribute("data-slot")).toBe("contact-link");
    expect(link.className).toContain("min-h-11");
    expect(link.querySelector('[data-testid="icon"]')).not.toBeNull();
    expect(label(link).textContent).toBe("전화");
    expect(document.querySelectorAll("a")).toHaveLength(1);
  });

  it("underline: 밑줄은 글자에만 걸리고 아이콘(글자 밖)에는 걸리지 않는다. 화살표 없음", () => {
    render(<TextButton icon={<Icon />}>지도</TextButton>);
    const button = screen.getByRole("button");
    expect(label(button).className.split(" ")).toEqual(expect.arrayContaining(["underline", "decoration-1", "underline-offset-3"]));
    expect(button.className).not.toContain("underline");
    expect(label(button).contains(screen.getByTestId("icon"))).toBe(false);
    expect(arrow(button)).toBeNull();
  });

  it("arrow: 밑줄 없이 글자 뒤에 화살표(asChild에서도)", () => {
    render(
      <TextButton variant="arrow" asChild>
        <a href="https://example.com/more">더 보기</a>
      </TextButton>,
    );
    const link = screen.getByRole("link", { name: "더 보기" });
    expect(label(link).className).not.toContain("underline");
    const icon = arrow(link)!;
    expect(icon).not.toBeNull();
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(label(link).compareDocumentPosition(icon) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("size: caption은 12/16, body는 14/20. 굵기 600과 아이콘 크기 14px, 누르는 영역은 두 크기가 같다(B7)", () => {
    render(
      <>
        <TextButton size="caption" icon={<Icon />}>
          작게
        </TextButton>
        <TextButton size="body" icon={<Icon />}>
          크게
        </TextButton>
      </>,
    );
    const caption = screen.getByRole("button", { name: "작게" });
    const body = screen.getByRole("button", { name: "크게" });
    expect(caption.getAttribute("data-size")).toBe("caption");
    expect(body.getAttribute("data-size")).toBe("body");
    expect(caption.className.split(" ")).toContain("text-caption");
    expect(caption.className.split(" ")).not.toContain("text-body");
    expect(body.className.split(" ")).toContain("text-body");
    expect(body.className.split(" ")).not.toContain("text-caption");
    for (const button of [caption, body]) {
      expect(button.className.split(" ")).toEqual(
        expect.arrayContaining(["font-semibold", "text-text", "[&_svg]:size-3.5", "-my-3", "min-h-11", "min-w-11"]),
      );
    }
  });

  it("비활성 <button>: 글자·아이콘 text-disabled, 밑줄은 그대로, 누름·호버 색은 비활성이 아닐 때만, 눌리지 않는다(B8)", () => {
    const onClick = vi.fn();
    render(
      <TextButton disabled icon={<Icon />} onClick={onClick}>
        다시 시도
      </TextButton>,
    );
    const button = screen.getByRole("button", { name: "다시 시도" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const list = button.className.split(" ");
    // 아이콘은 currentColor라 글자색을 따른다
    expect(list).toEqual(expect.arrayContaining(["disabled:text-disabled-text", "disabled:cursor-not-allowed"]));
    // 비활성일 때도 걸리는 누름·호버 색은 없다
    expect(list).not.toContain("active:text-text-2");
    expect(list).not.toContain("hover:text-text-2");
    expect(list.some((name) => name.includes("opacity"))).toBe(false);
    expect(label(button).className.split(" ")).toEqual(expect.arrayContaining(["underline", "decoration-1", "underline-offset-3"]));
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("asChild 링크에는 비활성 모양이 없다: 비활성 클래스는 disabled:(<button>만)로만 걸리고 <a>에는 disabled가 넘어가지 않는다", () => {
    render(
      <TextButton asChild>
        <a href="https://example.com/map">지도</a>
      </TextButton>,
    );
    const link = screen.getByRole("link", { name: "지도" });
    expect(link.hasAttribute("disabled")).toBe(false);
    expect(link.hasAttribute("aria-disabled")).toBe(false);
    const stateless = link.className.split(" ").filter((name) => name.includes("disabled-text") || name.includes("not-allowed"));
    expect(stateless.length).toBeGreaterThan(0);
    expect(stateless.every((name) => name.startsWith("disabled:"))).toBe(true);
  });

  it("clear: 밑줄도 화살표도 없다", () => {
    render(<TextButton variant="clear">닫기</TextButton>);
    const button = screen.getByRole("button");
    expect(label(button).className).not.toContain("underline");
    expect(arrow(button)).toBeNull();
  });
});
