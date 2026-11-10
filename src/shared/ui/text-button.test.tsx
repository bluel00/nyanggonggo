// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TextButton } from "./text-button";

afterEach(cleanup);

const Icon = () => <svg data-testid="icon" aria-hidden />;
const label = (element: HTMLElement) => element.querySelector('[data-slot="text-button-label"]')!;
const arrow = (element: HTMLElement) => element.querySelector('[data-slot="text-button-arrow"]');

describe("TextButton (handoff (l), #127)", () => {
  it("기본은 type=button인 <button>이고 밑줄 variant다. 글자 text 600, 누르는 영역 44px", () => {
    render(<TextButton>보기</TextButton>);
    const button = screen.getByRole("button", { name: "보기" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
    expect(button.getAttribute("data-variant")).toBe("underline");
    expect(button.className.split(" ")).toEqual(
      expect.arrayContaining(["text-caption", "font-semibold", "text-text", "active:text-text-2", "hover:text-text-2", "-my-3", "min-h-11", "min-w-11"]),
    );
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

  it("clear: 밑줄도 화살표도 없다", () => {
    render(<TextButton variant="clear">닫기</TextButton>);
    const button = screen.getByRole("button");
    expect(label(button).className).not.toContain("underline");
    expect(arrow(button)).toBeNull();
  });
});
