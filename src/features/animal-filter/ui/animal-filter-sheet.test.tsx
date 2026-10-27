// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REGION_COOKIE } from "../model/region-cookie";
import { SPECIES_COOKIE } from "../model/species-cookie";
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

const FILTER = { species: "cat", region: "6110000", district: "3000000", status: "protected", sex: "all", sort: "latest" } as const;
const select = (name: string) => screen.getByRole("combobox", { name }) as HTMLSelectElement;
const optionLabels = (el: HTMLSelectElement) => [...el.options].map((o) => o.textContent);
const open = (name = "필터") => fireEvent.click(screen.getByRole("button", { name }));
/** 이름이 붙은 칩 묶음(보호 상태, 성별) 안의 칩. 두 묶음 모두 "전체"가 있다 */
const chipIn = (group: string, name: string) => within(screen.getByRole("group", { name: group })).getByRole("button", { name });

describe("AnimalFilterSheet", () => {
  describe("성별(이슈 #20)", () => {
    beforeEach(() => {
      for (const cookie of document.cookie.split("; ").filter(Boolean)) {
        document.cookie = `${cookie.split("=")[0]}=; max-age=0; path=/`;
      }
    });

    it("전체 / 암컷 / 수컷 칩이 있고 기본은 전체다", () => {
      render(<AnimalFilterSheet filter={FILTER} />);
      open();
      const group = within(screen.getByRole("group", { name: "성별" }));
      expect(group.getAllByRole("button").map((b) => b.textContent)).toEqual(["전체", "암컷", "수컷"]);
      expect(chipIn("성별", "전체").getAttribute("aria-pressed")).toBe("true");
    });

    it("암컷을 적용하면 URL에 sex=female이 들어가고, 전체로 되돌리면 sex가 빠진다", () => {
      render(<AnimalFilterSheet filter={FILTER} />);
      open();
      fireEvent.click(chipIn("성별", "암컷"));
      fireEvent.click(screen.getByRole("button", { name: "적용하기" }));
      expect(replace).toHaveBeenLastCalledWith(
        "/?utm_source=kakao&species=cat&region=6110000&district=3000000&sex=female",
        { scroll: false },
      );
      cleanup();

      currentSearch = "utm_source=kakao&sex=female";
      render(<AnimalFilterSheet filter={{ ...FILTER, sex: "female" }} />);
      open("필터, 암컷");
      fireEvent.click(chipIn("성별", "전체"));
      fireEvent.click(screen.getByRole("button", { name: "적용하기" }));
      expect(replace).toHaveBeenLastCalledWith("/?utm_source=kakao&species=cat&region=6110000&district=3000000", {
        scroll: false,
      });
    });

    it("적용하기는 지역·축종만 쿠키에 기억하고 성별은 쿠키에 남기지 않는다", () => {
      render(<AnimalFilterSheet filter={FILTER} />);
      open();
      fireEvent.click(chipIn("성별", "수컷"));
      fireEvent.click(screen.getByRole("button", { name: "적용하기" }));
      expect(document.cookie).toContain(`${SPECIES_COOKIE}=cat`);
      expect(document.cookie).toContain(`${REGION_COOKIE}=`);
      expect(document.cookie).not.toMatch(/sex|male/);
    });

    it("성별을 골랐으면 [필터] 버튼이 선택 모양이고 이름에 성별이 붙는다(토글 아님)", () => {
      render(<AnimalFilterSheet filter={{ ...FILTER, sex: "male" }} />);
      const trigger = screen.getByRole("button", { name: "필터, 수컷" });
      expect(trigger.hasAttribute("data-selected")).toBe(true);
      expect(trigger.hasAttribute("aria-pressed")).toBe(false);
      cleanup();

      render(<AnimalFilterSheet filter={FILTER} />);
      expect(screen.getByRole("button", { name: "필터" }).hasAttribute("data-selected")).toBe(false);
    });
  });

  it("선택 후 [적용하기]에서만 router.replace로 URL을 바꾼다(기본값은 생략, 다른 파라미터 보존)", () => {
    render(<AnimalFilterSheet filter={FILTER} />);
    open();
    fireEvent.click(screen.getByRole("radio", { name: "강아지" }));
    fireEvent.click(chipIn("보호 상태", "전체"));
    fireEvent.click(screen.getByRole("radio", { name: "공고 마감 빠른순" }));
    fireEvent.change(select("시/도"), { target: { value: "6260000" } });
    fireEvent.change(select("시/군/구"), { target: { value: "3250000" } });
    expect(replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "적용하기" }));
    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith(
      "/?utm_source=kakao&species=dog&region=6260000&district=3250000&status=all&sort=deadline",
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
    render(<AnimalFilterSheet filter={{ species: "dog", region: "6110000", status: "ended", sex: "all", sort: "deadline" }} />);
    open();
    expect(screen.getByRole("radio", { name: "강아지" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("button", { name: "종료" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("radio", { name: "공고 마감 빠른순" }).getAttribute("aria-checked")).toBe("true");
    expect(select("시/도").value).toBe("6110000");
    expect(select("시/군/구").value).toBe("");
  });

  it("기본 필터(서울 전체)로 열면 시도는 서울, 시군구는 '전체'", () => {
    render(<AnimalFilterSheet filter={{ species: "cat", region: "6110000", status: "protected", sex: "all", sort: "latest" }} />);
    open();
    expect(select("시/도").value).toBe("6110000");
    expect(select("시/군/구").value).toBe("");
    expect(select("시/군/구").disabled).toBe(false);
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
    expect(replace).toHaveBeenCalledWith("/?utm_source=kakao&species=cat&region=all", { scroll: false });
  });

  it("시군구가 없는 시도(세종)는 시군구가 비활성", () => {
    render(<AnimalFilterSheet filter={FILTER} />);
    open();
    fireEvent.change(select("시/도"), { target: { value: "5690000" } });
    expect(select("시/군/구").disabled).toBe(true);
  });
});
