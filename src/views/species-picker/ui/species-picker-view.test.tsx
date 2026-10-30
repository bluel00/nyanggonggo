// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SERVICE_NAME, SERVICE_TAGLINE } from "@/shared/config/service";
import { SpeciesPickerView } from "./species-picker-view";

afterEach(cleanup);

describe("SpeciesPickerView: 질문 두 줄(#115)", () => {
  it("질문은 \"오늘은 누구를 / 보러 왔어요?\" 두 줄로 고정하고, 접근성 이름·글자 내용은 한 문장이다", () => {
    render(<SpeciesPickerView area={{}} />);
    const heading = screen.getByRole("heading", { level: 1, name: "오늘은 누구를 보러 왔어요?" });
    expect(heading.textContent).toBe("오늘은 누구를 보러 왔어요?");
    const lines = [...heading.children];
    expect(lines.map((line) => line.textContent)).toEqual(["오늘은 누구를", "보러 왔어요?"]);
    for (const line of lines) expect(line.className.split(" ")).toEqual(expect.arrayContaining(["block", "whitespace-nowrap"]));
    expect(heading.className).toContain("text-display-home");
  });
});

describe("SpeciesPickerView: 위쪽 로고와 한 줄 소개(#64, #66)", () => {
  it("로고(가로 조합 56, 이름은 서비스 이름) 아래에 한 줄 소개를 두 줄로 보인다. 둘 다 등장 효과가 없다", () => {
    render(<SpeciesPickerView area={{}} />);
    const logo = screen.getByRole("img", { name: SERVICE_NAME });
    expect(logo.dataset.combo).toBe("lockup");
    expect(logo.dataset.variant).toBe("line");
    const tagline = screen.getByText((_, element) => element?.textContent === SERVICE_TAGLINE && element.tagName === "P");
    expect(tagline.textContent).toBe("보호 중인 아이들의 공고가\n더 많은 사람에게 닿도록.");
    expect(tagline.className).toContain("whitespace-pre-line");
    expect(logo.compareDocumentPosition(tagline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tagline.closest("[data-enter]")).toBeNull();
    expect(logo.closest("[data-enter]")).toBeNull();
  });
});
