import type { Animal } from "../model/animal";

/** 축종 표기. 화면 타이틀("고양이 공고"), 필터, alt 텍스트가 함께 쓴다. */
export const SPECIES_LABEL: Record<Animal["species"], string> = {
  cat: "고양이",
  dog: "강아지",
};

/** 성별 표기(handoff 화면 3: 암컷 / 수컷 / 성별 미상, 임의 결정) */
export const SEX_LABEL: Record<Animal["sex"], string> = {
  female: "암컷",
  male: "수컷",
  unknown: "성별 미상",
};
