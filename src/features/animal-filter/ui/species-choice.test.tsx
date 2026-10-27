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
    render(<SpeciesChoice area={{ region: SEOUL, district: JONGNO }} enterFrom={1} />);
    expect(hrefOf("고양이")).toBe(`/?species=cat&region=${SEOUL}&district=${JONGNO}`);
    expect(hrefOf("강아지")).toBe(`/?species=dog&region=${SEOUL}&district=${JONGNO}`);
    expect(hrefOf("기타 동물")).toBe(`/?species=other&region=${SEOUL}&district=${JONGNO}`);
  });

  it("전국은 region=all로 넘긴다(기억된 지역이 끼어들지 않게)", () => {
    render(<SpeciesChoice area={{}} enterFrom={1} />);
    expect(hrefOf("고양이")).toBe("/?species=cat&region=all");
  });

  it("고르면 축종을 기억한다", () => {
    render(<SpeciesChoice area={{ region: SEOUL }} enterFrom={1} />);
    fireEvent.click(screen.getByRole("link", { name: "강아지" }));
    expect(document.cookie).toContain(`${SPECIES_COOKIE}=dog`);
  });

  it("고양이·강아지 선택지에는 캐릭터가 장식(alt 비움)으로 들어가고, 이름은 텍스트 라벨이 정한다", () => {
    render(<SpeciesChoice area={{ region: SEOUL }} enterFrom={1} />);
    for (const [name, src] of [
      ["고양이", "/characters/nyang-cat.svg"],
      ["강아지", "/characters/nyang-dog.svg"],
    ]) {
      const images = screen.getByRole("link", { name }).querySelectorAll("img");
      expect(images).toHaveLength(1);
      expect(images[0].getAttribute("alt")).toBe("");
      expect(images[0].getAttribute("src")).toBe(src);
    }
  });

  it("기타는 큰 카드 아래 낮은 가로 카드이고, 이름은 \"기타 동물\"이다. 새·토끼·거북이와 chevron은 장식이다(#86)", () => {
    render(<SpeciesChoice area={{ region: SEOUL }} enterFrom={1} />);
    const card = screen.getByRole("link", { name: "기타 동물" });
    expect(card.className).toContain("h-[72px]");
    const images = [...card.querySelectorAll("img")];
    expect(images.map((img) => img.getAttribute("src"))).toEqual([
      "/characters/nyang-bird.svg",
      "/characters/nyang-rabbit.svg",
      "/characters/nyang-turtle.svg",
    ]);
    expect(images.every((img) => img.getAttribute("alt") === "")).toBe(true);
    expect(images[0].parentElement!.getAttribute("aria-hidden")).toBe("true");
    const chevron = card.querySelector("svg")!;
    expect(chevron.getAttribute("aria-hidden")).toBe("true");
    expect(chevron.getAttribute("class")).toContain("lucide-chevron-right");
  });

  it("기타 동물 카드는 등장 순서에서 강아지 다음이다(링크 자리를 받는다)", () => {
    render(<SpeciesChoice area={{ region: SEOUL }} enterFrom={1} />);
    const order = (name: string) => screen.getByRole("link", { name }).style.getPropertyValue("--enter-i");
    expect([order("고양이"), order("강아지"), order("기타 동물")]).toEqual(["1", "2", "3"]);
  });

  it("기타 동물 카드를 고르면 기타 축종을 기억한다", () => {
    render(<SpeciesChoice area={{ region: SEOUL }} enterFrom={1} />);
    fireEvent.click(screen.getByRole("link", { name: "기타 동물" }));
    expect(document.cookie).toContain(`${SPECIES_COOKIE}=other`);
  });
});
