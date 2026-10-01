import { describe, expect, it } from "vitest";
import type { Animal } from "../model/animal";
import { ANIMAL_COPY, animalTitle, SEX_LABEL, SPECIES_COPY, SPECIES_LABEL, speciesText } from "./labels";

const SPECIES: Animal["species"][] = ["cat", "dog", "other"];

describe("축종 문구", () => {
  it("모든 축종에 라벨과 문구가 있다", () => {
    for (const species of SPECIES) {
      expect(SPECIES_LABEL[species], species).toBeTruthy();
      const copy = SPECIES_COPY[species];
      expect(Object.values(copy).every((text) => typeof text === "string" && text.length > 0), species).toBe(true);
    }
    expect(Object.keys(SPECIES_COPY).sort()).toEqual([...SPECIES].sort());
  });

  it("문구에 조사가 바르게 붙어 있다(라벨 + 템플릿으로 만들지 않는다)", () => {
    for (const species of SPECIES) {
      const { emptyTitle, errorTitle } = SPECIES_COPY[species];
      expect(emptyTitle, species).toMatch(/[가이] 없어요$/);
      expect(errorTitle, species).toMatch(/[를을] 불러오지 못했어요$/);
    }
  });

  it("축종 중립 문구에는 축종 이름이 없다(찜 목록은 축종이 섞인다)", () => {
    for (const [key, text] of Object.entries(ANIMAL_COPY)) {
      for (const label of Object.values(SPECIES_LABEL)) {
        expect(text, `${key}에 "${label}"이 들어 있다`).not.toContain(label);
      }
    }
  });

  it("성별 라벨은 세 가지다", () => {
    expect(Object.keys(SEX_LABEL).sort()).toEqual(["female", "male", "unknown"]);
  });
});

describe("speciesText", () => {
  it("고양이와 강아지는 축종 라벨이다(kindText는 쓰지 않는다)", () => {
    expect(speciesText({ species: "cat", kindText: "한국 고양이" })).toBe("고양이");
    expect(speciesText({ species: "dog", kindText: "믹스견" })).toBe("강아지");
  });

  it("기타 축종은 실제 동물 이름을 쓴다", () => {
    expect(speciesText({ species: "other", kindText: "토끼" })).toBe("토끼");
    expect(speciesText({ species: "other", kindText: "앵무새" })).toBe("앵무새");
  });

  it("기타인데 동물 이름이 없으면 기본 라벨", () => {
    expect(speciesText({ species: "other", kindText: null })).toBe("기타 동물");
  });
});

describe("animalTitle", () => {
  const region = "서울특별시 성동구";

  it("고양이와 강아지는 지역만 쓴다", () => {
    expect(animalTitle({ species: "cat", kindText: "한국 고양이", regionText: region })).toBe(region);
    expect(animalTitle({ species: "dog", kindText: "믹스견", regionText: region })).toBe(region);
  });

  it("기타 축종은 어떤 동물인지를 지역 앞에 붙인다", () => {
    expect(animalTitle({ species: "other", kindText: "토끼", regionText: region })).toBe(`토끼 · ${region}`);
    expect(animalTitle({ species: "other", kindText: null, regionText: region })).toBe(`기타 동물 · ${region}`);
  });
});
