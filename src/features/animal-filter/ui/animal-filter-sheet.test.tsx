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

const FILTER = { species: "cat", region: "6110000", district: "3000000", status: "protected", sort: "latest" } as const;
const select = (name: string) => screen.getByRole("combobox", { name }) as HTMLSelectElement;
const optionLabels = (el: HTMLSelectElement) => [...el.options].map((o) => o.textContent);
const open = () => fireEvent.click(screen.getByRole("button", { name: "필터" }));

describe("AnimalFilterSheet", () => {
  it("선택 후 [적용하기]에서만 router.replace로 URL을 바꾼다(기본값은 생략, 다른 파라미터 보존)", () => {
    render(<AnimalFilterSheet filter={FILTER} />);
    open();
    fireEvent.click(screen.getByRole("radio", { name: "강아지" }));
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    fireEvent.click(screen.getByRole("radio", { name: "종료임박순" }));
    fireEvent.change(select("시/도"), { target: { value: "6260000" } });
    fireEvent.change(select("시/군/구"), { target: { value: "3250000" } });
    expect(replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "적용하기" }));
    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith(
      "/?utm_source=kakao&species=dog&region=6260000&district=3250000&status=all&sort=endingSoon",
      { scroll: false },
    );
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
    expect(select("시/도").value).toBe("6110000");
    expect(select("시/군/구").value).toBe("");
  });

  it("기본 필터로 열면 서울/종로구가 선택되어 있다", () => {
    render(<AnimalFilterSheet filter={FILTER} />);
    open();
    expect(select("시/도").value).toBe("6110000");
    expect(select("시/군/구").value).toBe("3000000");
  });

  it("시도를 바꾸면 시군구 목록이 그 시도로 바뀌고 '전체'로 돌아간다", () => {
    render(<AnimalFilterSheet filter={FILTER} />);
    open();
    expect(optionLabels(select("시/군/구"))).toContain("종로구");
    fireEvent.change(select("시/도"), { target: { value: "6260000" } });
    expect(select("시/군/구").value).toBe("");
    expect(optionLabels(select("시/군/구"))).toContain("해운대구");
    expect(optionLabels(select("시/군/구"))).not.toContain("종로구");
  });

  it("전체 시/도(전국)를 고르면 시군구는 비활성이고, 적용하면 region=all", () => {
    render(<AnimalFilterSheet filter={FILTER} />);
    open();
    fireEvent.change(select("시/도"), { target: { value: "all" } });
    expect(select("시/군/구").disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "적용하기" }));
    expect(replace).toHaveBeenCalledWith("/?utm_source=kakao&region=all", { scroll: false });
  });

  it("시군구가 없는 시도(세종)는 시군구가 비활성", () => {
    render(<AnimalFilterSheet filter={FILTER} />);
    open();
    fireEvent.change(select("시/도"), { target: { value: "5690000" } });
    expect(select("시/군/구").disabled).toBe(true);
  });
});
