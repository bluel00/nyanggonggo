// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SERVICE_NAME, SERVICE_TAGLINE } from "@/shared/config/service";
import { SpeciesPickerView } from "./species-picker-view";

afterEach(cleanup);

describe("SpeciesPickerView: 위쪽 서비스 이름과 한 줄 소개(#64)", () => {
  it("서비스 이름 아래에 한 줄 소개를 두 줄로 보인다", () => {
    render(<SpeciesPickerView area={{}} />);
    const name = screen.getByText(SERVICE_NAME);
    const tagline = screen.getByText((_, element) => element?.textContent === SERVICE_TAGLINE && element.tagName === "P");
    expect(SERVICE_NAME).toBe("멍냥공고");
    expect(tagline.textContent).toBe("보호 중인 아이들의 공고가\n더 많은 사람에게 닿도록.");
    expect(tagline.className).toContain("whitespace-pre-line");
    expect(name.compareDocumentPosition(tagline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 등장 효과가 없다(처음부터 보인다)
    expect(tagline.closest("[data-enter]")).toBeNull();
    expect(name.closest("[data-enter]")).toBeNull();
  });
});
