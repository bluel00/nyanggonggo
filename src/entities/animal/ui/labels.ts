import type { Animal } from "../model/animal";

/** 축종 표기. 필터 옵션, 사진 alt, 공유 제목이 함께 쓴다. */
export const SPECIES_LABEL: Record<Animal["species"], string> = {
  cat: "고양이",
  dog: "강아지",
  other: "기타 동물",
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
  other: {
    listTitle: "기타 동물 공고",
    emptyTitle: "조건에 맞는 기타 동물이 없어요",
    errorTitle: "지금은 기타 동물을 불러오지 못했어요",
  },
};

/**
 * 축종이 섞이는 화면(찜 목록), 축종을 알 수 없는 화면(상세 조회 실패), 축종을 고르는 화면(홈)의 문구. 축종 중립이다.
 * 찜 목록은 고양이, 강아지가 함께 들어오므로 명세 4.5.2의 "고양이" 문구를 "공고"로 바꿔 쓴다.
 */
export const ANIMAL_COPY = {
  /** 홈(축종 선택) 화면. 문구는 시안("냥공고 홈 · 축종 선택"의 Main) 그대로다 */
  homeTitle: "오늘은 누구를 보러 왔어요?",
  /** 시안의 줄바꿈을 지킨다. 화면은 `whitespace-pre-line`으로 그린다 */
  homeDescription: "한 번 고르면 기억해둘게요.\n목록에서 언제든 바꿀 수 있어요.",
  /** 기타 축종으로 가는 작은 텍스트 링크(고양이·강아지와 같은 무게로 두지 않는다) */
  homeOtherLink: "다른 동물들도 있어요",
  homeMetaTitle: "어떤 친구를 볼까요",
  /** 목록 헤더의 홈 진입점. 타이틀과 함께 읽히는 보조 라벨이다 */
  homeEntryLabel: "축종 바꾸기",
  favoritesTitle: "찜한 공고",
  favoritesEmptyTitle: "아직 찜한 공고가 없어요",
  /** 🐾는 README가 허용한 유일한 이모지(찜 빈 상태) */
  favoritesEmptyDescription: "마음에 드는 공고를 저장해보세요 🐾",
  favoritesErrorTitle: "지금은 찜한 공고를 불러오지 못했어요",
  detailErrorTitle: "지금은 공고를 불러오지 못했어요",
} as const;

/**
 * 화면에 쓰는 축종 텍스트. 기타 축종은 "기타 동물"이 아니라 실제 동물 이름(토끼, 앵무새…)을 쓴다.
 * 업스트림 `kindFullNm`에서 뽑은 `kindText`가 그 이름이며, 뽑을 수 없으면 라벨("기타 동물")로 돌아간다.
 * 사진 alt, 공유 제목, OG 제목, 카드/상세 타이틀이 함께 쓴다.
 */
export function speciesText(animal: Pick<Animal, "species" | "kindText">): string {
  if (animal.species !== "other") return SPECIES_LABEL[animal.species];
  return animal.kindText ?? SPECIES_LABEL.other;
}

/**
 * 카드 1줄과 상세 타이틀. Domain에 이름이 없어 기본은 지역이고, 기타 축종은 어떤 동물인지를
 * 지역 앞에 붙인다("토끼 · 서울특별시 성동구"). 기타 공고의 카드/상세 디자인은 시안이 없어 임시다(12절 43).
 */
export function animalTitle(animal: Pick<Animal, "species" | "kindText" | "regionText">): string {
  return animal.species === "other" ? `${speciesText(animal)} · ${animal.regionText}` : animal.regionText;
}

/** 성별 표기(handoff 화면 3: 암컷 / 수컷 / 성별 미상, 임의 결정) */
export const SEX_LABEL: Record<Animal["sex"], string> = {
  female: "암컷",
  male: "수컷",
  unknown: "성별 미상",
};
