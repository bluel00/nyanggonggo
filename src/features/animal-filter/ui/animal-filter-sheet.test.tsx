// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimalFilterSheet } from "./animal-filter-sheet";

const replace = vi.fn();
let currentSearch = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

beforeEach(() => {
  currentSearch = "utm_source=kakao";
});
afterEach(() => {
  cleanup();
  replace.mockClear();
});

const FILTER = { species: "cat", status: "protected", sort: "latest" } as const;
const open = () => fireEvent.click(screen.getByRole("button", { name: "필터" }));

describe("AnimalFilterSheet", () => {
  it("선택 후 [적용하기]에서만 router.replace로 URL을 바꾼다(기본값은 생략, 다른 파라미터 보존)", () => {
    render(<AnimalFilterSheet filter={FILTER} />);
    open();
    fireEvent.click(screen.getByRole("radio", { name: "강아지" }));
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    fireEvent.click(screen.getByRole("radio", { name: "종료임박순" }));
    fireEvent.change(screen.getByRole("combobox", { name: "지역" }), { target: { value: "6260000" } });
    expect(replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "적용하기" }));
    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith("/?utm_source=kakao&species=dog&region=6260000&status=all&sort=endingSoon", {
      scroll: false,
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("적용하지 않고 닫으면 URL을 바꾸지 않고, 다시 열면 현재 값(URL)으로 돌아간다", () => {
    render(<AnimalFilterSheet filter={FILTER} />);
    open();
    fireEvent.click(screen.getByRole("radio", { name: "강아지" }));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(replace).not.toHaveBeenCalled();

    open();
    expect(screen.getByRole("radio", { name: "고양이" }).getAttribute("aria-checked")).toBe("true");
  });

  it("트리거 Chip은 body 글자 크기와 text 색을 함께 가진다(cn 테마 설정)", () => {
    render(<AnimalFilterSheet filter={FILTER} />);
    const trigger = screen.getByRole("button", { name: "필터" });
    expect(trigger.className).toContain("text-body");
    expect(trigger.className).toContain("text-text");
  });

  it("열면 현재 필터가 선택되어 있다", () => {
    render(<AnimalFilterSheet filter={{ species: "dog", region: "6110000", status: "ended", sort: "endingSoon" }} />);
    open();
    expect(screen.getByRole("radio", { name: "강아지" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("button", { name: "종료" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("radio", { name: "종료임박순" }).getAttribute("aria-checked")).toBe("true");
    expect((screen.getByRole("combobox", { name: "지역" }) as HTMLSelectElement).value).toBe("6110000");
  });
});
