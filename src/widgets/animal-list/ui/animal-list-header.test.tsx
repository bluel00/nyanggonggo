// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { AnimalListFilter } from "@/entities/animal";
import { AnimalListHeader } from "./animal-list-header";

afterEach(cleanup);

const BUSAN = "6260000";
const filter = (species: AnimalListFilter["species"]): AnimalListFilter => ({
  species,
  region: BUSAN,
  status: "protected",
  sort: "latest",
});

describe("AnimalListHeader: 홈 진입점(시안 Header-A)", () => {
  it("타이틀이 홈으로 가는 링크이고, 스크린리더는 '다른 동물 고르기'까지 읽는다", () => {
    render(<AnimalListHeader filter={filter("cat")} />);
    const link = screen.getByRole("link", { name: "고양이 공고, 다른 동물 고르기" });
    expect(link.getAttribute("href")).toBe(`/home?region=${BUSAN}`);
    // 시안처럼 h1 안의 링크다. 보이는 제목 글자는 타이틀뿐이다(숨김 텍스트는 sr-only)
    expect(link.closest("h1")).not.toBeNull();
  });

  it("기타 축종도 같은 진입점이다", () => {
    render(<AnimalListHeader filter={filter("other")} />);
    expect(screen.getByRole("link", { name: "기타 동물 공고, 다른 동물 고르기" })).toBeTruthy();
  });

  it("chevron은 20px에서 선이 1.8px로 보인다(24 기준 2.16)", () => {
    const { container } = render(<AnimalListHeader filter={filter("dog")} />);
    const chevron = container.querySelector("a svg");
    expect(chevron?.getAttribute("width")).toBe("20");
    expect(Number(chevron?.getAttribute("stroke-width"))).toBeCloseTo(2.16);
    expect(chevron?.getAttribute("aria-hidden")).toBe("true");
  });
});
