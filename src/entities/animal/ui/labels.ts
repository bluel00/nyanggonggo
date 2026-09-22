import type { Animal } from "../model/animal";

/** 축종 표기. 화면 타이틀("고양이 공고"), 필터, alt 텍스트가 함께 쓴다. */
export const SPECIES_LABEL: Record<Animal["species"], string> = {
  cat: "고양이",
  dog: "강아지",
};
