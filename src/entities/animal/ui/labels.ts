import type { Animal } from "../model/animal";

/** 축종 표기. 필터 옵션, 사진 alt, 공유 제목이 함께 쓴다. */
export const SPECIES_LABEL: Record<Animal["species"], string> = {
  cat: "고양이",
  dog: "강아지",
};

/**
 * 축종에 따라 달라지는 문구를 한곳에 모은다(architecture.md 7절).
 * 조사가 붙는 문장("…가 없어요", "…를 불러오지")은 라벨에 템플릿을 붙여 만들 수 없어
 * 축종별로 문장을 그대로 적는다.
 */
export type SpeciesCopy = {
  /** 목록 헤더 타이틀(handoff 화면 1~2) */
  listTitle: string;
  /** 조건에 맞는 공고가 없을 때(handoff 화면 6) */
  emptyTitle: string;
  /** 목록을 불러오지 못했을 때(handoff 화면 6) */
  errorTitle: string;
};

export const SPECIES_COPY: Record<Animal["species"], SpeciesCopy> = {
  cat: {
    listTitle: "고양이 공고",
    emptyTitle: "조건에 맞는 고양이가 없어요",
    errorTitle: "지금은 고양이를 불러오지 못했어요",
  },
  dog: {
    listTitle: "강아지 공고",
    emptyTitle: "조건에 맞는 강아지가 없어요",
    errorTitle: "지금은 강아지를 불러오지 못했어요",
  },
};

/**
 * 축종이 섞이는 화면(찜 목록)과 축종을 알 수 없는 화면(상세 조회 실패)의 문구. 축종 중립이다.
 * 찜 목록은 고양이, 강아지가 함께 들어오므로 명세 4.5.2의 "고양이" 문구를 "공고"로 바꿔 쓴다.
 */
export const ANIMAL_COPY = {
  favoritesTitle: "찜한 공고",
  favoritesEmptyTitle: "아직 찜한 공고가 없어요",
  /** 🐾는 README가 허용한 유일한 이모지(찜 빈 상태) */
  favoritesEmptyDescription: "마음에 드는 공고를 저장해보세요 🐾",
  favoritesErrorTitle: "지금은 찜한 공고를 불러오지 못했어요",
  detailErrorTitle: "지금은 공고를 불러오지 못했어요",
} as const;

/** 성별 표기(handoff 화면 3: 암컷 / 수컷 / 성별 미상, 임의 결정) */
export const SEX_LABEL: Record<Animal["sex"], string> = {
  female: "암컷",
  male: "수컷",
  unknown: "성별 미상",
};
