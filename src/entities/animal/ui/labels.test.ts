import { describe, expect, it } from "vitest";
import type { Animal } from "../model/animal";
import { ANIMAL_COPY, SEX_LABEL, SPECIES_COPY, SPECIES_LABEL } from "./labels";

const SPECIES: Animal["species"][] = ["cat", "dog"];

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
