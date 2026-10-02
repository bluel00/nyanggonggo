// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SPECIES_COOKIE } from "../model/species-cookie";
import { SpeciesChoice } from "./species-choice";

afterEach(cleanup);

const SEOUL = "6110000";
const JONGNO = "3000000";

function hrefOf(name: string) {
  return screen.getByRole("link", { name }).getAttribute("href");
}

describe("SpeciesChoice", () => {
  it("축종마다 그 축종·지역의 목록으로 간다(축종과 지역을 늘 명시)", () => {
    render(<SpeciesChoice area={{ region: SEOUL, district: JONGNO }} />);
    expect(hrefOf("고양이")).toBe(`/?species=cat&region=${SEOUL}&district=${JONGNO}`);
    expect(hrefOf("강아지")).toBe(`/?species=dog&region=${SEOUL}&district=${JONGNO}`);
    expect(hrefOf("다른 동물들도 있어요")).toBe(`/?species=other&region=${SEOUL}&district=${JONGNO}`);
  });

  it("전국은 region=all로 넘긴다(기억된 지역이 끼어들지 않게)", () => {
    render(<SpeciesChoice area={{}} />);
    expect(hrefOf("고양이")).toBe("/?species=cat&region=all");
  });

  it("고르면 축종을 기억한다", () => {
    render(<SpeciesChoice area={{ region: SEOUL }} />);
    fireEvent.click(screen.getByRole("link", { name: "강아지" }));
    expect(document.cookie).toContain(`${SPECIES_COOKIE}=dog`);
  });

  it("기타는 큰 선택지가 아니라 작은 텍스트 링크다", () => {
    render(<SpeciesChoice area={{ region: SEOUL }} />);
    // 기타 링크에는 "기타 동물" 라벨을 쓰지 않는다(고양이·강아지와 같은 무게로 보이지 않게)
    expect(screen.queryByRole("link", { name: "기타 동물" })).toBeNull();
    expect(screen.getByRole("link", { name: "다른 동물들도 있어요" })).toBeTruthy();
  });
});
